import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const S3_BUCKET = process.env.S3_BUCKET!;
const YOUTUBE_DL_LAMBDA_ARN = process.env.YOUTUBE_DL_LAMBDA_ARN!;
const MAX_SONG_DURATION = parseInt(process.env.MAX_SONG_DURATION_SECONDS || '600');
const MAX_DJ_RECORDING = parseInt(process.env.MAX_DJ_RECORDING_SECONDS || '60');

/**
 * Extract YouTube video ID from URL
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
      return urlObj.searchParams.get('v');
    }
    
    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }
    
    // youtube.com/embed/VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
      return urlObj.pathname.split('/')[2];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /submit-song
 * Submit song metadata and trigger YouTube download
 * Body: { date, youtubeURL, songTitle, djType, djName, djMessage, djRecordingData, friendEmail, userId }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      date,
      youtubeURL,
      songTitle,
      startTime,
      endTime,
      djType,
      djName,
      djMessage,
      djRecordingData,
      friendEmail,
      userId,
    } = body;

    // Validate required fields
    if (!date || !youtubeURL || !songTitle || !djName || !djType || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields',
        }),
      };
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid date format',
        }),
      };
    }

    // Extract and validate YouTube video ID
    const videoId = extractYouTubeVideoId(youtubeURL);
    if (!videoId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid YouTube URL',
        }),
      };
    }

    // Check for duplicate video ID in all existing songs
    const scanCommand = new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :songPrefix)',
      ExpressionAttributeValues: {
        ':songPrefix': 'SONG#',
      },
    });
    
    const existingSongs = await docClient.send(scanCommand);
    
    if (existingSongs.Items) {
      for (const song of existingSongs.Items) {
        const existingVideoId = extractYouTubeVideoId(song.youtubeURL);
        if (existingVideoId === videoId) {
          return {
            statusCode: 409,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              success: false,
              error: 'This song has already been submitted',
              duplicate: {
                date: song.date,
                songTitle: song.songTitle,
                djName: song.djName,
              },
            }),
          };
        }
      }
    }

    // Check if user holds the lock
    const lockCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `LOCK#${date}` },
    }));

    if (!lockCheck.Item || lockCheck.Item.lockHolder !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'You do not hold the lock for this date',
        }),
      };
    }

    // Check if lock expired
    const now = Math.floor(Date.now() / 1000);
    if (lockCheck.Item.expiresAt <= now) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Lock has expired',
        }),
      };
    }

    // Check if date already has a song
    const songCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    if (songCheck.Item) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'This date already has a song',
        }),
      };
    }

    const jobId = uuidv4();
    let s3DJKey: string | undefined;

    // If recorded DJ message, upload to S3
    if (djType === 'recorded' && djRecordingData) {
      s3DJKey = `dj-messages/${date}/${jobId}.mp3`;
      
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3DJKey,
          Body: Buffer.from(djRecordingData, 'base64'),
          ContentType: 'audio/mpeg',
        }));
      } catch (error) {
        console.error('Error uploading DJ recording:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to upload DJ recording',
          }),
        };
      }
    }

    // Create initial song entry with pending status
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `SONG#${date}`,
        date,
        songTitle, // Now required, no fallback to 'Processing...'
        youtubeURL,
        videoId, // Store for easy duplicate checking
        s3SongKey: `songs/${date}/${jobId}.mp3`, // Will be created by youtube-dl
        thumbnailS3Key: `thumbnails/${date}/${jobId}.jpg`,
        djName,
        djType,
        djMessage: djMessage || '',
        s3DJKey,
        friendEmail: friendEmail || '',
        submittedBy: userId,
        createdAt: now,
        processingStatus: 'pending',
        jobId,
      },
    }));

    // Delete the lock
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `LOCK#${date}` },
    }));

    // Invoke youtube-dl Lambda asynchronously (skip in local dev)
    if (YOUTUBE_DL_LAMBDA_ARN && YOUTUBE_DL_LAMBDA_ARN !== 'local-dev-mock') {
      const youtubeDLPayload = {
        jobId,
        date,
        youtubeURL,
        startTime,
        endTime,
        maxDuration: MAX_SONG_DURATION,
      };

      await lambdaClient.send(new InvokeCommand({
        FunctionName: YOUTUBE_DL_LAMBDA_ARN,
        InvocationType: 'Event', // Asynchronous
        Payload: JSON.stringify(youtubeDLPayload),
      }));
    } else {
      console.log('Skipping youtube-dl Lambda invocation (local dev mode)');
    }

    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        jobId,
        date,
        message: 'Song submission accepted, processing started',
      }),
    };

  } catch (error) {
    console.error('Error in submit-song handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to submit song',
      }),
    };
  }
}
