import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME!;
const S3_BUCKET = process.env.S3_BUCKET!;

interface SongEntry {
  PK: string;
  date: string;
  songTitle: string;
  youtubeURL: string;
  s3SongKey: string;
  s3CombinedKey?: string;
  thumbnailS3Key?: string;
  djName: string;
  djType: 'recorded' | 'tts';
  djMessage?: string;
  s3DJKey?: string;
  friendEmail?: string;
  submittedBy: string;
  processingStatus?: string;
}

/**
 * POST /admin/block-date
 * Mark a date as unavailable by creating a placeholder entry
 * Body: { date: "YYYY-MM-DD", reason?: string }
 */
async function blockDate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { date, reason } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        }),
      };
    }

    // Check if date already has a song
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    if (existing.Item) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Date already has a song',
        }),
      };
    }

    // Create blocked date placeholder
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `SONG#${date}`,
        date,
        songTitle: '[BLOCKED]',
        youtubeURL: '',
        s3SongKey: '',
        djName: 'Admin',
        djType: 'tts',
        submittedBy: 'admin',
        processingStatus: 'blocked',
        blockedReason: reason || 'Administratively blocked',
        createdAt: Math.floor(Date.now() / 1000),
      },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Date blocked successfully',
      }),
    };

  } catch (error) {
    console.error('Error blocking date:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to block date',
      }),
    };
  }
}

/**
 * DELETE /admin/unblock-date
 * Remove a blocked date placeholder
 * Body: { date: "YYYY-MM-DD" }
 */
async function unblockDate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { date } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        }),
      };
    }

    // Check if date is blocked
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Date not found',
        }),
      };
    }

    if (existing.Item.processingStatus !== 'blocked') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Date is not blocked (has a real song)',
        }),
      };
    }

    // Delete blocked placeholder
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Date unblocked successfully',
      }),
    };

  } catch (error) {
    console.error('Error unblocking date:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to unblock date',
      }),
    };
  }
}

/**
 * PUT /admin/move-song
 * Move a song from one date to another
 * Body: { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" }
 */
async function moveSong(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { fromDate, toDate } = body;

    if (!fromDate || !toDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        }),
      };
    }

    // Get source song
    const sourceResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${fromDate}` },
    }));

    if (!sourceResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Source date has no song',
        }),
      };
    }

    const song = sourceResult.Item as SongEntry;

    // Check if it's a blocked placeholder
    if (song.processingStatus === 'blocked') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Cannot move blocked date placeholder',
        }),
      };
    }

    // Check if target date is available
    const targetResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${toDate}` },
    }));

    if (targetResult.Item) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Target date already has a song',
        }),
      };
    }

    // Copy S3 objects to new keys if they exist
    const s3KeyUpdates: Record<string, string> = {};

    if (song.s3SongKey) {
      const newSongKey = song.s3SongKey.replace(fromDate, toDate);
      try {
        await s3Client.send(new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${song.s3SongKey}`,
          Key: newSongKey,
        }));
        s3KeyUpdates.s3SongKey = newSongKey;
      } catch (error) {
        console.error('Error copying song S3 object:', error);
      }
    }

    if (song.s3CombinedKey) {
      const newCombinedKey = song.s3CombinedKey.replace(fromDate, toDate);
      try {
        await s3Client.send(new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${song.s3CombinedKey}`,
          Key: newCombinedKey,
        }));
        s3KeyUpdates.s3CombinedKey = newCombinedKey;
      } catch (error) {
        console.error('Error copying combined S3 object:', error);
      }
    }

    if (song.thumbnailS3Key) {
      const newThumbnailKey = song.thumbnailS3Key.replace(fromDate, toDate);
      try {
        await s3Client.send(new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${song.thumbnailS3Key}`,
          Key: newThumbnailKey,
        }));
        s3KeyUpdates.thumbnailS3Key = newThumbnailKey;
      } catch (error) {
        console.error('Error copying thumbnail S3 object:', error);
      }
    }

    if (song.s3DJKey) {
      const newDJKey = song.s3DJKey.replace(fromDate, toDate);
      try {
        await s3Client.send(new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${song.s3DJKey}`,
          Key: newDJKey,
        }));
        s3KeyUpdates.s3DJKey = newDJKey;
      } catch (error) {
        console.error('Error copying DJ S3 object:', error);
      }
    }

    // Create new entry with updated date and S3 keys
    const newSong = {
      ...song,
      PK: `SONG#${toDate}`,
      date: toDate,
      ...s3KeyUpdates,
      movedFrom: fromDate,
      movedAt: Math.floor(Date.now() / 1000),
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newSong,
    }));

    // Delete old entry
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${fromDate}` },
    }));

    // Delete old S3 objects
    const deletePromises = [];
    if (song.s3SongKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3SongKey,
      })));
    }
    if (song.s3CombinedKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3CombinedKey,
      })));
    }
    if (song.thumbnailS3Key) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.thumbnailS3Key,
      })));
    }
    if (song.s3DJKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3DJKey,
      })));
    }
    await Promise.all(deletePromises);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: `Song moved from ${fromDate} to ${toDate}`,
      }),
    };

  } catch (error) {
    console.error('Error moving song:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to move song',
      }),
    };
  }
}

/**
 * DELETE /admin/delete-song
 * Remove a song from the calendar entirely
 * Body: { date: "YYYY-MM-DD" }
 */
async function deleteSong(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { date } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        }),
      };
    }

    // Get song entry
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Song not found',
        }),
      };
    }

    const song = result.Item as SongEntry;

    // Delete S3 objects
    const deletePromises = [];
    if (song.s3SongKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3SongKey,
      })));
    }
    if (song.s3CombinedKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3CombinedKey,
      })));
    }
    if (song.thumbnailS3Key) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.thumbnailS3Key,
      })));
    }
    if (song.s3DJKey) {
      deletePromises.push(s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: song.s3DJKey,
      })));
    }
    await Promise.allSettled(deletePromises); // Use allSettled to continue even if some deletions fail

    // Delete DynamoDB entry
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Song deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting song:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete song',
      }),
    };
  }
}

/**
 * Main router for admin operations
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path || event.resource;
  const method = event.httpMethod;

  // Remove stage prefix if present
  const cleanPath = path.replace(/^\/[^/]+\/admin/, '/admin');

  if (cleanPath === '/admin/block-date' && method === 'POST') {
    return blockDate(event);
  }

  if (cleanPath === '/admin/unblock-date' && method === 'DELETE') {
    return unblockDate(event);
  }

  if (cleanPath === '/admin/move-song' && method === 'PUT') {
    return moveSong(event);
  }

  if (cleanPath === '/admin/delete-song' && method === 'DELETE') {
    return deleteSong(event);
  }

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: false,
      error: 'Admin route not found',
    }),
  };
}
