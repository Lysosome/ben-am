import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * DELETE /cancel-submission
 * Cancel a pending submission (used when timeout occurs)
 * Deletes the song entry to free up the date
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
          error: 'Missing required fields: date and userId',
        }),
      };
    }

    // Check if song exists and is in pending/processing state
    const songCheck = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${date}` },
    }));

    if (!songCheck.Item) {
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

    // Verify the user submitted this song
    if (songCheck.Item.submittedBy !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Not authorized to cancel this submission',
        }),
      };
    }

    // Only allow cancellation if still pending or processing (not completed)
    if (songCheck.Item.processingStatus === 'completed') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Cannot cancel completed submission',
        }),
      };
    }

    // Delete the song entry to free up the date
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
        message: 'Submission cancelled successfully',
      }),
    };

  } catch (error) {
    console.error('Error in cancel-submission handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to cancel submission',
      }),
    };
  }
}
