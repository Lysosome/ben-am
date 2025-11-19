import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * POST /unlock-date
 * Release a date lock
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

    // Check if lock exists
    const lockCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `LOCK#${date}` },
    }));

    if (!lockCheck.Item) {
      // No lock exists, that's fine
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: 'No lock to release',
        }),
      };
    }

    // Verify the user holds the lock
    if (lockCheck.Item.lockHolder !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Not authorized to release this lock',
        }),
      };
    }

    // Delete the lock
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `LOCK#${date}` },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Lock released successfully',
      }),
    };

  } catch (error) {
    console.error('Error in unlock-date handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to unlock date',
      }),
    };
  }
}
