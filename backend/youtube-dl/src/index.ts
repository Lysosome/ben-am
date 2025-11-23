import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME!;
const S3_BUCKET = process.env.S3_BUCKET!;
const MAX_DURATION = parseInt(process.env.MAX_SONG_DURATION_SECONDS || '600');

// Path to binaries (from Lambda layer or local)
const YT_DLP_BIN = process.env.YT_DLP_BIN || '/opt/bin/yt-dlp';
const FFMPEG_BIN = process.env.FFMPEG_BIN || '/opt/bin/ffmpeg';
const COOKIES_FILE_SOURCE = process.env.COOKIES_FILE || '/opt/cookies/cookies.txt';
const COOKIES_FILE = '/tmp/cookies.txt'; // Writable location for yt-dlp

interface YouTubeDownloadEvent {
  jobId: string;
  date: string;
  youtubeURL: string;
  startTime?: number;
  endTime?: number;
  maxDuration: number;
}

/**
 * YouTube-DL Lambda Handler
 * Downloads and converts YouTube videos to MP3, extracts thumbnails
 * 
 * NOTE: This requires youtube-dl (or yt-dlp) and ffmpeg binaries
 * to be available via Lambda layers or bundled in the deployment package
 */
export async function handler(event: YouTubeDownloadEvent): Promise<void> {
  const startTime = Date.now();
  console.log(`[PERF] Lambda handler started at ${new Date().toISOString()}`);
  
  const { jobId, date, youtubeURL, startTime: clipStartTime, endTime, maxDuration } = event;
  const tmpDir = '/tmp';
  const audioFile = path.join(tmpDir, `${jobId}.mp3`);
  const thumbnailFile = path.join(tmpDir, `${jobId}.jpg`);
  const s3SongKey = `songs/${date}/${jobId}.mp3`;
  const s3ThumbnailKey = `thumbnails/${date}/${jobId}.jpg`;

  try {
    // Copy cookies from read-only layer to writable /tmp
    // (yt-dlp needs to write to the cookies file to update them)
    const t0 = Date.now();
    const cookiesContent = await readFile(COOKIES_FILE_SOURCE, 'utf-8');
    await writeFile(COOKIES_FILE, cookiesContent);
    console.log(`[PERF] Copied cookies: ${Date.now() - t0}ms`);

    // Update status to processing
    const t1 = Date.now();
    await updateProcessingStatus(date, 'processing', 0);
    console.log(`[PERF] Updated DynamoDB status: ${Date.now() - t1}ms`);

    // Download video info to get metadata
    const t2 = Date.now();
    console.log('Fetching video metadata...');
    const videoInfo = await getVideoInfo(youtubeURL);
    
    if (!videoInfo) {
      throw new Error('Failed to fetch video info');
    }

    console.log(`[PERF] Fetched video info: ${Date.now() - t2}ms`);
    console.log('Video info:', videoInfo);

    // Calculate duration constraints
    const actualStartTime = clipStartTime || 0;
    const videoDuration = videoInfo.duration || maxDuration; // Fallback to maxDuration if not available
    const actualEndTime = endTime || Math.min(videoDuration, actualStartTime + maxDuration);
    const clipDuration = actualEndTime - actualStartTime;

    if (clipDuration <= 0 || isNaN(clipDuration)) {
      throw new Error(`Invalid clip duration calculated: ${clipDuration}s (start: ${actualStartTime}s, end: ${actualEndTime}s)`);
    }

    if (clipDuration > maxDuration) {
      throw new Error(`Clip duration (${clipDuration}s) exceeds maximum (${maxDuration}s)`);
    }

    // Download and convert to MP3
    const t3 = Date.now();
    console.log('Downloading and converting audio...');
    await downloadAudio(youtubeURL, audioFile, actualStartTime, clipDuration);
    console.log(`[PERF] Downloaded and converted audio: ${Date.now() - t3}ms`);
    await updateProcessingStatus(date, 'processing', 50);

    // Download thumbnail
    const t4 = Date.now();
    console.log('Downloading thumbnail...');
    await downloadThumbnail(youtubeURL, thumbnailFile);
    console.log(`[PERF] Downloaded thumbnail: ${Date.now() - t4}ms`);
    await updateProcessingStatus(date, 'processing', 70);

    // Upload to S3
    const t5 = Date.now();
    console.log('Uploading audio to S3...');
    const audioBuffer = await readFile(audioFile);
    console.log(`[PERF] Read audio file (${audioBuffer.length} bytes): ${Date.now() - t5}ms`);
    
    const t6 = Date.now();
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3SongKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    }));
    console.log(`[PERF] Uploaded audio to S3: ${Date.now() - t6}ms`);
    await updateProcessingStatus(date, 'processing', 85);

    const t7 = Date.now();
    console.log('Uploading thumbnail to S3...');
    const thumbnailBuffer = await readFile(thumbnailFile);
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3ThumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    }));
    console.log(`[PERF] Uploaded thumbnail to S3: ${Date.now() - t7}ms`);
    await updateProcessingStatus(date, 'processing', 95);

    // Update DynamoDB with completion status
    // Note: Do NOT overwrite songTitle - keep what user submitted
    const t8 = Date.now();
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
      UpdateExpression: 'SET processingStatus = :status, #dur = :duration, s3SongKey = :songKey, thumbnailS3Key = :thumbKey',
      ExpressionAttributeNames: {
        '#dur': 'duration',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':duration': clipDuration,
        ':songKey': s3SongKey,
        ':thumbKey': s3ThumbnailKey,
      },
    }));
    console.log(`[PERF] Updated DynamoDB completion: ${Date.now() - t8}ms`);

    // Cleanup temp files
    const t9 = Date.now();
    await Promise.all([
      unlink(audioFile).catch(() => {}),
      unlink(thumbnailFile).catch(() => {}),
      unlink(COOKIES_FILE).catch(() => {}),
    ]);
    console.log(`[PERF] Cleaned up temp files: ${Date.now() - t9}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[PERF] ✅ TOTAL PROCESSING TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log('Processing completed successfully');

  } catch (error) {
    console.error('Error in YouTube-DL handler:', error);
    
    // Cleanup temp files on error
    await Promise.all([
      unlink(audioFile).catch(() => {}),
      unlink(thumbnailFile).catch(() => {}),
      unlink(COOKIES_FILE).catch(() => {}),
    ]).catch(() => {});
    
    // Update status to failed
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
      UpdateExpression: 'SET processingStatus = :status, processingError = :error',
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':error': (error as Error).message,
      },
    }));

    throw error;
  }
}

/**
 * Get video information using youtube-dl
 */
async function getVideoInfo(url: string): Promise<{ title: string; duration: number } | null> {
  return new Promise((resolve, reject) => {
    console.log('Using yt-dlp binary:', YT_DLP_BIN);
    const ytdl = spawn(YT_DLP_BIN, [
      '--dump-json',
      '--no-playlist',
      '--cookies', COOKIES_FILE,
      // Let yt-dlp auto-select best client (tv/web safari) with cookies
      url,
    ]);

    let stdout = '';
    let stderr = '';

    ytdl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdl.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp error:', stderr);
        reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || 'Unknown',
          duration: info.duration || 0,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Download and convert audio to MP3 using yt-dlp and ffmpeg
 */
async function downloadAudio(url: string, outputFile: string, startTime: number, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '192K',
      '--no-playlist',
      '--cookies', COOKIES_FILE,
      // Let yt-dlp auto-select best client (tv/web safari) with cookies
      '--output', outputFile.replace('.mp3', '.%(ext)s'),
    ];

    // Add time constraints if specified
    if (startTime > 0 || duration < Infinity) {
      args.push('--postprocessor-args', 
        `ffmpeg:-ss ${startTime} -t ${duration}`);
    }

    args.push(url);

    console.log('Downloading audio with args:', args.join(' '));
    console.log('Using yt-dlp binary:', YT_DLP_BIN);
    const ytdl = spawn(YT_DLP_BIN, args);

    ytdl.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    ytdl.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    ytdl.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp audio download failed with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Download video thumbnail
 */
async function downloadThumbnail(url: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Using yt-dlp binary:', YT_DLP_BIN);
    const ytdl = spawn(YT_DLP_BIN, [
      '--write-thumbnail',
      '--skip-download',
      '--convert-thumbnails', 'jpg',
      '--no-playlist',
      '--cookies', COOKIES_FILE,
      // Let yt-dlp auto-select best client (tv/web safari) with cookies
      '--output', outputFile.replace('.jpg', '.%(ext)s'),
      url,
    ]);

    ytdl.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    ytdl.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    ytdl.on('close', (code) => {
      if (code !== 0) {
        // Thumbnail download is optional, don't fail the whole job
        console.warn('Thumbnail download failed, continuing...');
        resolve();
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update processing status in DynamoDB
 */
async function updateProcessingStatus(date: string, status: string, progress: number): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `SONG#${date}` },
    UpdateExpression: 'SET processingStatus = :status, progress = :progress',
    ExpressionAttributeValues: {
      ':status': status,
      ':progress': progress,
    },
  }));
}
