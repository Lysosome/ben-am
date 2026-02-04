import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand, Engine, OutputFormat, VoiceId } from '@aws-sdk/client-polly';
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const pollyClient = new PollyClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const S3_BUCKET = process.env.S3_BUCKET!;
const MAX_DURATION = parseInt(process.env.MAX_SONG_DURATION_SECONDS || '600');

// Path to binaries (from Lambda layer or local)
const YT_DLP_BIN = process.env.YT_DLP_BIN || '/opt/bin/yt-dlp';
const FFMPEG_BIN = process.env.FFMPEG_BIN || '/opt/bin/ffmpeg';
const ASCII_CONVERTER_BIN = process.env.ASCII_CONVERTER_BIN || '/opt/bin/ascii-image-converter';
const COOKIES_FILE_SOURCE = process.env.COOKIES_FILE || '/opt/cookies/cookies.txt';
const COOKIES_FILE = '/tmp/cookies.txt'; // Writable location for yt-dlp

const ASCII_ART_WIDTH_CHARACTERS = 60;

interface YouTubeDownloadEvent {
  jobId: string;
  date: string;
  youtubeURL: string;
  startTime?: number;
  endTime?: number;
  maxDuration: number;
}

interface SongEntry {
  PK: string;
  date: string;
  songTitle: string;
  djName: string;
  djType: 'recorded' | 'tts';
  djMessage?: string;
  s3DJKey?: string;
  friendEmail?: string;
}

/**
 * YouTube-DL Lambda Handler
 * Downloads YouTube videos, converts to MP3, generates TTS via Polly,
 * and combines song + DJ message + optional review prompt into one MP3
 */
export async function handler(event: YouTubeDownloadEvent): Promise<void> {
  const startTime = Date.now();
  console.log(`[PERF] Lambda handler started at ${new Date().toISOString()}`);
  
  const { jobId, date, youtubeURL, startTime: clipStartTime, endTime, maxDuration } = event;
  const tmpDir = '/tmp';
  const audioFile = path.join(tmpDir, `${jobId}.mp3`);
  const thumbnailFile = path.join(tmpDir, `${jobId}.jpg`);
  const djMessageFile = path.join(tmpDir, `${jobId}_dj.mp3`);
  const reviewPromptFile = path.join(tmpDir, `${jobId}_review.mp3`);
  const combinedFile = path.join(tmpDir, `${jobId}_combined.mp3`);
  // Separate S3 keys: original song vs combined audio (song + DJ + review prompt)
  const s3SongKey = `songs/${date}/${jobId}.mp3`;
  const s3CombinedKey = `combined/${date}/${jobId}.mp3`;
  const s3ThumbnailKey = `thumbnails/${date}/${jobId}.jpg`;

  try {
    // Copy cookies from read-only layer to writable /tmp
    const t0 = Date.now();
    const cookiesContent = await readFile(COOKIES_FILE_SOURCE, 'utf-8');
    await writeFile(COOKIES_FILE, cookiesContent);
    console.log(`[PERF] Copied cookies: ${Date.now() - t0}ms`);

    // Update status to processing
    const t1 = Date.now();
    await updateProcessingStatus(date, 'processing', 0);
    console.log(`[PERF] Updated DynamoDB status: ${Date.now() - t1}ms`);

    // Fetch song entry from DynamoDB for DJ message info
    const songEntry = await getSongEntry(date);
    console.log('Song entry:', JSON.stringify(songEntry, null, 2));

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
    const videoDuration = videoInfo.duration || maxDuration;
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
    await updateProcessingStatus(date, 'processing', 40);

    // Download thumbnail
    const t4 = Date.now();
    console.log('Downloading thumbnail...');
    await downloadThumbnail(youtubeURL, thumbnailFile);
    console.log(`[PERF] Downloaded thumbnail: ${Date.now() - t4}ms`);
    
    // Convert thumbnail to ASCII art using ascii-image-converter binary
    let asciiThumbnail: string = '';
    try {
      console.log('Converting thumbnail to ASCII art...');
      const t4b = Date.now();
      asciiThumbnail = await convertToAscii(thumbnailFile, ASCII_ART_WIDTH_CHARACTERS);
      console.log(`[PERF] Converted thumbnail to ASCII art: ${Date.now() - t4b}ms`);
      console.log(`ASCII thumbnail length: ${asciiThumbnail?.length || 0} characters`);
    } catch (asciiError) {
      console.warn('ASCII thumbnail conversion failed (non-critical):', asciiError);
    }
    await updateProcessingStatus(date, 'processing', 50);

    // Prepare audio files to concatenate
    const filesToConcat: string[] = [audioFile];

    // Generate or download DJ message
    if (songEntry) {
      const t5 = Date.now();
      if (songEntry.djType === 'tts' && songEntry.djMessage) {
        // Generate TTS via Amazon Polly
        console.log('Generating DJ message TTS via Polly...');
        await generateTTSAudio(songEntry.djMessage, djMessageFile);
        filesToConcat.push(djMessageFile);
        console.log(`[PERF] Generated TTS DJ message: ${Date.now() - t5}ms`);
      } else if (songEntry.djType === 'recorded' && songEntry.s3DJKey) {
        // Download recorded DJ message from S3
        // The file is likely .webm (from browser MediaRecorder) - normalization will convert to MP3
        console.log('Downloading recorded DJ message from S3:', songEntry.s3DJKey);
        const djExt = path.extname(songEntry.s3DJKey) || '.webm';
        const djDownloadPath = path.join(tmpDir, `${jobId}_dj${djExt}`);
        await downloadFromS3(songEntry.s3DJKey, djDownloadPath);
        
        // Log the downloaded file info
        const djStats = require('fs').statSync(djDownloadPath);
        console.log(`Downloaded DJ recording: ${djStats.size} bytes, extension: ${djExt}`);
        
        filesToConcat.push(djDownloadPath);
        console.log(`[PERF] Downloaded recorded DJ message: ${Date.now() - t5}ms`);
      }
      await updateProcessingStatus(date, 'processing', 60);

      // If friend provided email, add review prompt TTS
      if (songEntry.friendEmail && songEntry.djName) {
        const t6 = Date.now();
        console.log('Generating review prompt TTS...');
        const reviewPromptText = `To leave a review for ${songEntry.djName}, say Alexa, ask Ben A. M. to leave a review.`;
        await generateTTSAudio(reviewPromptText, reviewPromptFile);
        filesToConcat.push(reviewPromptFile);
        console.log(`[PERF] Generated review prompt TTS: ${Date.now() - t6}ms`);
      }
    }
    await updateProcessingStatus(date, 'processing', 70);

    // Concatenate all audio files into one combined MP3
    const t7 = Date.now();
    let hasCombinedAudio = false;
    if (filesToConcat.length > 1) {
      console.log(`Concatenating ${filesToConcat.length} audio files...`);
      console.log('Files to concatenate:', filesToConcat);
      
      // Log file sizes before concatenation for debugging
      for (const f of filesToConcat) {
        try {
          const stats = require('fs').statSync(f);
          console.log(`  - ${path.basename(f)}: ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);
        } catch (e) {
          console.log(`  - ${path.basename(f)}: MISSING or ERROR`);
        }
      }
      
      await concatenateAudioFiles(filesToConcat, combinedFile);
      hasCombinedAudio = true;
      
      // Log combined file size
      const combinedStats = require('fs').statSync(combinedFile);
      console.log(`Combined audio file: ${combinedStats.size} bytes (${(combinedStats.size / 1024).toFixed(1)} KB)`);
      console.log(`[PERF] Concatenated audio files: ${Date.now() - t7}ms`);
    } else {
      console.log('Only 1 audio file (song only), no DJ message or review prompt to append');
    }
    await updateProcessingStatus(date, 'processing', 75);

    // Upload original song audio to S3 (before concatenation)
    const t8 = Date.now();
    console.log('Uploading original song audio to S3...');
    const songBuffer = await readFile(audioFile);
    console.log(`Original song file size: ${songBuffer.length} bytes (${(songBuffer.length / 1024).toFixed(1)} KB)`);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3SongKey,
      Body: songBuffer,
      ContentType: 'audio/mpeg',
    }));
    console.log(`[PERF] Uploaded original song to S3 (${s3SongKey}): ${Date.now() - t8}ms`);
    await updateProcessingStatus(date, 'processing', 85);

    // Upload combined audio to separate S3 key (song + DJ + review prompt)
    const t9 = Date.now();
    let finalCombinedKey = s3SongKey; // Default to song key if no combination happened
    if (hasCombinedAudio) {
      console.log('Uploading combined audio to S3...');
      const combinedBuffer = await readFile(combinedFile);
      console.log(`Combined file size: ${combinedBuffer.length} bytes (${(combinedBuffer.length / 1024).toFixed(1)} KB)`);
      console.log(`Size increase from concatenation: ${((combinedBuffer.length - songBuffer.length) / 1024).toFixed(1)} KB`);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3CombinedKey,
        Body: combinedBuffer,
        ContentType: 'audio/mpeg',
      }));
      finalCombinedKey = s3CombinedKey;
      console.log(`[PERF] Uploaded combined audio to S3 (${s3CombinedKey}): ${Date.now() - t9}ms`);
    } else {
      console.log('No combined audio created, s3CombinedKey will point to original song');
      finalCombinedKey = s3SongKey;
    }
    await updateProcessingStatus(date, 'processing', 90);

    // Upload thumbnail to S3
    const t10 = Date.now();
    console.log('Uploading thumbnail to S3...');
    try {
      const thumbnailBuffer = await readFile(thumbnailFile);
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3ThumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));
      console.log(`[PERF] Uploaded thumbnail to S3: ${Date.now() - t10}ms`);
    } catch (thumbError) {
      console.warn('Thumbnail upload failed (non-critical):', thumbError);
    }
    await updateProcessingStatus(date, 'processing', 95);

    // Update DynamoDB with completion status
    const t11 = Date.now();
    console.log('Updating DynamoDB with completion status...');
    console.log(`  s3SongKey: ${s3SongKey}`);
    console.log(`  s3CombinedKey: ${finalCombinedKey}`);
    console.log(`  thumbnailS3Key: ${s3ThumbnailKey}`);
    console.log(`  asciiThumbnail: ${asciiThumbnail ? `${asciiThumbnail.length} chars` : 'none'}`);
    
    // Build update expression dynamically to include asciiThumbnail if available
    let updateExpression = 'SET processingStatus = :status, #dur = :duration, s3SongKey = :songKey, s3CombinedKey = :combinedKey, thumbnailS3Key = :thumbKey';
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': 'completed',
      ':duration': clipDuration,
      ':songKey': s3SongKey,
      ':combinedKey': finalCombinedKey,
      ':thumbKey': s3ThumbnailKey,
    };
    
    if (asciiThumbnail) {
      updateExpression += ', asciiThumbnail = :asciiThumb';
      expressionAttributeValues[':asciiThumb'] = asciiThumbnail;
    }
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#dur': 'duration',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    }));
    console.log(`[PERF] Updated DynamoDB completion: ${Date.now() - t11}ms`);

    // Cleanup temp files
    const t12 = Date.now();
    await Promise.all([
      unlink(audioFile).catch(() => {}),
      unlink(thumbnailFile).catch(() => {}),
      unlink(djMessageFile).catch(() => {}),
      unlink(reviewPromptFile).catch(() => {}),
      unlink(combinedFile).catch(() => {}),
      unlink(COOKIES_FILE).catch(() => {}),
    ]);
    console.log(`[PERF] Cleaned up temp files: ${Date.now() - t12}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[PERF] ✅ TOTAL PROCESSING TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log('Processing completed successfully');

  } catch (error) {
    console.error('Error in YouTube-DL handler:', error);
    
    // Cleanup temp files on error
    await Promise.all([
      unlink(audioFile).catch(() => {}),
      unlink(thumbnailFile).catch(() => {}),
      unlink(djMessageFile).catch(() => {}),
      unlink(reviewPromptFile).catch(() => {}),
      unlink(combinedFile).catch(() => {}),
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
 * Get song entry from DynamoDB
 */
async function getSongEntry(date: string): Promise<SongEntry | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `SONG#${date}` },
  }));
  return result.Item as SongEntry | null;
}

/**
 * Generate TTS audio using Amazon Polly
 */
async function generateTTSAudio(text: string, outputFile: string): Promise<void> {
  console.log(`Generating TTS for: "${text.substring(0, 50)}..."`);
  
  const response = await pollyClient.send(new SynthesizeSpeechCommand({
    Engine: 'standard' as Engine,
    OutputFormat: 'mp3' as OutputFormat,
    Text: text,
    VoiceId: 'Nicole' as VoiceId, // Australian English female voice
    SampleRate: '22050',
  }));

  if (!response.AudioStream) {
    throw new Error('Polly did not return audio stream');
  }

  // Write audio stream to file
  const audioStream = response.AudioStream as Readable;
  const writeStream = createWriteStream(outputFile);
  await pipeline(audioStream, writeStream);
  
  console.log(`TTS audio written to ${outputFile}`);
}

/**
 * Download file from S3
 */
async function downloadFromS3(s3Key: string, outputFile: string): Promise<void> {
  console.log(`Downloading from S3: ${s3Key}`);
  
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  }));

  if (!response.Body) {
    throw new Error(`S3 object not found: ${s3Key}`);
  }

  const bodyStream = response.Body as Readable;
  const writeStream = createWriteStream(outputFile);
  await pipeline(bodyStream, writeStream);
  
  console.log(`Downloaded S3 file to ${outputFile}`);
}

/**
 * Concatenate multiple audio files using ffmpeg with normalization
 * This function:
 * 1. Probes each input file to log its format (for debugging)
 * 2. Normalizes all inputs to consistent format (44.1kHz, stereo, 128kbps MP3)
 * 3. Adds 1 second of silence between each clip
 * 4. Uses filter_complex for reliable concatenation regardless of input formats
 */
async function concatenateAudioFiles(inputFiles: string[], outputFile: string): Promise<void> {
  // First, probe each file to understand what we're dealing with
  console.log('=== AUDIO FILE ANALYSIS ===');
  for (const file of inputFiles) {
    await probeAudioFile(file);
  }
  console.log('=== END AUDIO FILE ANALYSIS ===');

  // Normalize each input file to consistent format and create silence files
  const normalizedFiles: string[] = [];
  const silenceFile = '/tmp/silence_1s.mp3';
  
  // Generate 1 second of silence
  console.log('Generating 1 second silence file...');
  await generateSilence(silenceFile, 1);
  
  for (let i = 0; i < inputFiles.length; i++) {
    const inputFile = inputFiles[i];
    // Create normalized output path - always output as .mp3 regardless of input format
    const inputExt = path.extname(inputFile);
    const inputBase = inputFile.slice(0, -inputExt.length);
    const normalizedFile = `${inputBase}_normalized.mp3`;
    
    console.log(`Normalizing file ${i + 1}/${inputFiles.length}: ${path.basename(inputFile)} -> ${path.basename(normalizedFile)}`);
    await normalizeAudioFile(inputFile, normalizedFile);
    
    normalizedFiles.push(normalizedFile);
    
    // Add silence after each file except the last one
    if (i < inputFiles.length - 1) {
      normalizedFiles.push(silenceFile);
    }
  }

  console.log('Normalized files to concatenate:', normalizedFiles.map(f => path.basename(f)));

  // Now concatenate the normalized files using concat demuxer
  return new Promise((resolve, reject) => {
    const fileListContent = normalizedFiles.map(f => `file '${f}'`).join('\n');
    const fileListPath = '/tmp/concat_list.txt';
    
    require('fs').writeFileSync(fileListPath, fileListContent);
    console.log(`Concat file list:\n${fileListContent}`);

    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', fileListPath,
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputFile
    ];

    console.log(`Running ffmpeg concat with args: ${args.join(' ')}`);
    const ffmpeg = spawn(FFMPEG_BIN, args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      // Log ffmpeg output for debugging
      console.log('=== FFMPEG CONCAT STDERR ===');
      console.log(stderr);
      console.log('=== END FFMPEG CONCAT STDERR ===');

      // Clean up normalized files and silence
      for (const f of normalizedFiles) {
        if (f !== silenceFile) {
          try { require('fs').unlinkSync(f); } catch {}
        }
      }
      try { require('fs').unlinkSync(silenceFile); } catch {}
      try { require('fs').unlinkSync(fileListPath); } catch {}

      if (code !== 0) {
        console.error('ffmpeg concat failed with code:', code);
        reject(new Error(`ffmpeg concat failed with code ${code}`));
      } else {
        // Verify output file
        try {
          const stats = require('fs').statSync(outputFile);
          console.log(`✅ Combined file created: ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);
          
          // Probe the output file too
          console.log('=== OUTPUT FILE ANALYSIS ===');
          await probeAudioFile(outputFile);
          console.log('=== END OUTPUT FILE ANALYSIS ===');
        } catch (e) {
          console.error('Failed to stat output file:', e);
        }
        resolve();
      }
    });
  });
}

/**
 * Probe an audio file using ffprobe and log its properties
 */
async function probeAudioFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    const ffprobeBin = FFMPEG_BIN.replace('ffmpeg', 'ffprobe');
    const args = [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-print_format', 'json',
      filePath
    ];

    const ffprobe = spawn(ffprobeBin, args);
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      const filename = path.basename(filePath);
      if (code !== 0) {
        console.log(`[PROBE] ${filename}: ffprobe failed - ${stderr}`);
        resolve();
        return;
      }

      try {
        const info = JSON.parse(stdout);
        const stream = info.streams?.[0] || {};
        const format = info.format || {};
        
        console.log(`[PROBE] ${filename}:`);
        console.log(`  - Codec: ${stream.codec_name || 'unknown'}`);
        console.log(`  - Sample Rate: ${stream.sample_rate || 'unknown'} Hz`);
        console.log(`  - Channels: ${stream.channels || 'unknown'}`);
        console.log(`  - Bit Rate: ${stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate) / 1000)}kbps` : (format.bit_rate ? `${Math.round(parseInt(format.bit_rate) / 1000)}kbps` : 'unknown')}`);
        console.log(`  - Duration: ${format.duration ? `${parseFloat(format.duration).toFixed(2)}s` : 'unknown'}`);
        console.log(`  - Format: ${format.format_name || 'unknown'}`);
        console.log(`  - Size: ${format.size ? `${(parseInt(format.size) / 1024).toFixed(1)} KB` : 'unknown'}`);
      } catch (e) {
        console.log(`[PROBE] ${filename}: Failed to parse ffprobe output`);
      }
      resolve();
    });
  });
}

/**
 * Normalize an audio file to consistent format: 44.1kHz, stereo, 128kbps MP3
 * Also applies peak normalization to maximize volume without clipping
 */
async function normalizeAudioFile(inputFile: string, outputFile: string): Promise<void> {
  // First pass: detect the peak volume
  const peakDb = await detectPeakVolume(inputFile);
  
  // Calculate gain needed to reach 0dB peak (with small headroom)
  const targetPeak = -0.5; // Target -0.5dB to avoid any potential clipping
  const gainDb = targetPeak - peakDb;
  
  console.log(`  Peak: ${peakDb.toFixed(1)}dB, applying gain: ${gainDb.toFixed(1)}dB`);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputFile,
      '-af', `volume=${gainDb}dB`, // Apply peak normalization
      '-ar', '44100',      // 44.1kHz sample rate
      '-ac', '2',          // Stereo
      '-b:a', '128k',      // 128kbps bitrate
      '-c:a', 'libmp3lame',
      '-y',
      outputFile
    ];

    console.log(`  Normalizing: ffmpeg ${args.join(' ')}`);
    const ffmpeg = spawn(FFMPEG_BIN, args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      // Always log stderr for debugging
      console.log(`  [FFMPEG NORMALIZE STDERR for ${path.basename(inputFile)}]:`);
      console.log(stderr);
      
      if (code !== 0) {
        console.error(`  ❌ Normalize failed for ${path.basename(inputFile)} with exit code ${code}`);
        reject(new Error(`Failed to normalize ${inputFile}: ${stderr}`));
      } else {
        try {
          const inStats = require('fs').statSync(inputFile);
          const outStats = require('fs').statSync(outputFile);
          console.log(`  ✅ Normalized ${path.basename(inputFile)}: ${(inStats.size / 1024).toFixed(1)} KB → ${(outStats.size / 1024).toFixed(1)} KB`);
        } catch {}
        resolve();
      }
    });
  });
}

/**
 * Detect the peak volume of an audio file using ffmpeg volumedetect
 * Returns the max volume in dB (negative value, 0 = max)
 */
async function detectPeakVolume(inputFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputFile,
      '-af', 'volumedetect',
      '-f', 'null',
      '-'
    ];

    const ffmpeg = spawn(FFMPEG_BIN, args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      // volumedetect outputs to stderr even on success
      // Look for: max_volume: -X.X dB
      const match = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
      if (match) {
        const maxVolume = parseFloat(match[1]);
        console.log(`  Detected peak volume for ${path.basename(inputFile)}: ${maxVolume}dB`);
        resolve(maxVolume);
      } else {
        console.warn(`  Could not detect peak volume for ${path.basename(inputFile)}, using 0dB`);
        resolve(0); // Assume already normalized if we can't detect
      }
    });
  });
}

/**
 * Generate a silence audio file
 */
async function generateSilence(outputFile: string, durationSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo`,
      '-t', durationSeconds.toString(),
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '128k',
      '-c:a', 'libmp3lame',
      '-y',
      outputFile
    ];

    const ffmpeg = spawn(FFMPEG_BIN, args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error('Failed to generate silence:', stderr);
        reject(new Error('Failed to generate silence'));
      } else {
        try {
          const stats = require('fs').statSync(outputFile);
          console.log(`  ✅ Generated ${durationSeconds}s silence: ${(stats.size / 1024).toFixed(1)} KB`);
        } catch {}
        resolve();
      }
    });
  });
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
      '--js-runtimes', 'node',
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
      '--js-runtimes', 'node',
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
      '--js-runtimes', 'node',
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
        console.warn('Thumbnail download failed, continuing...');
        resolve();
      } else {
        resolve();
      }
    });
  });
}

/**
 * Convert an image to ASCII art using ascii-image-converter binary
 * @param imagePath Path to the image file
 * @param width Width of ASCII output in characters
 * @returns ASCII art string
 */
async function convertToAscii(imagePath: string, width: number): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Using ascii-image-converter binary:', ASCII_CONVERTER_BIN);
    
    const args = [
      imagePath,
      '--width', width.toString(),
      '--complex',         // Use a wider range of characters for more detail
      '--color',           // Enable ANSI color output
    ];

    console.log(`Running: ${ASCII_CONVERTER_BIN} ${args.join(' ')}`);
    
    // Force color output by setting COLORTERM environment variable
    // This tricks the tool into thinking it's running in a color-capable terminal
    const proc = spawn(ASCII_CONVERTER_BIN, args, {
      env: {
        ...process.env,
        COLORTERM: 'truecolor',  // Force 24-bit color support
        TERM: 'xterm-256color',   // Indicate 256 color terminal support
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('ascii-image-converter stderr:', stderr);
        reject(new Error(`ascii-image-converter failed with code ${code}: ${stderr}`));
      } else {
        // Log first few lines for debugging
        const lines = stdout.split('\n');
        console.log(`ASCII art generated: ${lines.length} lines, ${stdout.length} characters`);
        console.log('First 3 lines preview:', lines.slice(0, 3).join('\n'));
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ascii-image-converter: ${err.message}`));
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
