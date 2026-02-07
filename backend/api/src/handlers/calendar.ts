import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME!;
const S3_BUCKET = process.env.S3_BUCKET!;

interface SongEntry {
  PK: string;
  date: string;
  songTitle: string;
  thumbnailS3Key?: string;
  asciiThumbnail?: string;
  djName: string;
}

interface LockEntry {
  PK: string;
  lockHolder: string;
  expiresAt: number;
}

interface CalendarEntry {
  date: string;
  songTitle: string;
  thumbnailURL?: string;
  asciiThumbnail?: string;
  djName: string;
  isAvailable: boolean;
  isLocked?: boolean;
  lockedBy?: string;
}

/**
 * GET /calendar?lightweight=true (optional)
 * Fetch all existing songs and current locks for calendar display
 * If lightweight=true, excludes thumbnailURL and asciiThumbnail for faster polling
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const lightweight = event.queryStringParameters?.lightweight === 'true';

    // Scan for all SONG# and LOCK# entries
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :songPrefix) OR begins_with(PK, :lockPrefix)',
      ExpressionAttributeValues: {
        ':songPrefix': 'SONG#',
        ':lockPrefix': 'LOCK#',
      },
    }));

    const items = result.Items || [];
    const songs: SongEntry[] = [];
    const locks: LockEntry[] = [];

    // Separate songs and locks
    for (const item of items) {
      if (item.PK.startsWith('SONG#')) {
        songs.push(item as SongEntry);
      } else if (item.PK.startsWith('LOCK#')) {
        locks.push(item as LockEntry);
      }
    }

    // Build calendar entries
    const calendar: CalendarEntry[] = [];
    const locksMap = new Map<string, LockEntry>();
    
    locks.forEach(lock => {
      const date = lock.PK.replace('LOCK#', '');
      locksMap.set(date, lock);
    });

    // Add existing songs
    for (const song of songs) {
      let thumbnailURL: string | undefined;
      let asciiThumbnail: string | undefined;
      
      // Skip heavy fields in lightweight mode
      if (!lightweight) {
        if (song.thumbnailS3Key) {
          try {
            thumbnailURL = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: song.thumbnailS3Key,
              }),
              { expiresIn: 3600 } // 1 hour
            );
          } catch (error) {
            console.error('Error generating thumbnail URL:', error);
          }
        }
        
        asciiThumbnail = song.asciiThumbnail;
      }

      calendar.push({
        date: song.date,
        songTitle: song.songTitle,
        thumbnailURL,
        asciiThumbnail,
        djName: song.djName,
        isAvailable: false,
      });
    }

    // Add locked dates (without songs yet)
    for (const [date, lock] of locksMap) {
      // Skip if already has a song
      if (songs.some(s => s.date === date)) {
        continue;
      }

      // Check if lock is still valid
      const now = Math.floor(Date.now() / 1000);
      if (lock.expiresAt > now) {
        calendar.push({
          date,
          songTitle: '',
          djName: '',
          isAvailable: false,
          isLocked: true,
          lockedBy: lock.lockHolder,
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        calendar,
      }),
    };

  } catch (error) {
    console.error('Error in calendar handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch calendar data',
      }),
    };
  }
}
