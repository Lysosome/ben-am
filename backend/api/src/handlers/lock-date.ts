import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME!;
const DATE_LOCK_TTL_MINUTES = parseInt(process.env.DATE_LOCK_TTL_MINUTES || '15');

/**
 * POST /lock-date
 * Lock a date for submission (15-minute TTL)
 * Body: { date: "YYYY-MM-DD", userId: "cookie-id" }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { date, userId } = body;

    if (!date || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: date, userId',
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
          error: 'Invalid date format. Use YYYY-MM-DD',
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
          locked: false,
          error: 'This date already has a song',
        }),
      };
    }

    // Check if date is already locked
    const lockCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `LOCK#${date}` },
    }));

    const now = Math.floor(Date.now() / 1000);
    
    if (lockCheck.Item) {
      const existingLock = lockCheck.Item;
      
      // If lock expired, allow new lock
      if (existingLock.expiresAt <= now) {
        // Lock expired, proceed to create new lock
      } else if (existingLock.lockHolder === userId) {
        // User already holds the lock, refresh it
        const newExpiresAt = now + (DATE_LOCK_TTL_MINUTES * 60);
        
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `LOCK#${date}`,
            lockHolder: userId,
            expiresAt: newExpiresAt,
            createdAt: existingLock.createdAt || now,
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
            locked: true,
            expiresAt: newExpiresAt,
            message: 'Lock refreshed',
          }),
        };
      } else {
        // Lock held by someone else and not expired
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            locked: false,
            error: 'This date is locked by another user',
            expiresAt: existingLock.expiresAt,
          }),
        };
      }
    }

    // Create new lock
    const expiresAt = now + (DATE_LOCK_TTL_MINUTES * 60);
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `LOCK#${date}`,
        lockHolder: userId,
        expiresAt,
        createdAt: now,
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
        locked: true,
        expiresAt,
        message: 'Date locked successfully',
      }),
    };

  } catch (error) {
    console.error('Error in lock-date handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to lock date',
      }),
    };
  }
}
