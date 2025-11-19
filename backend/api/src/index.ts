import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as calendarHandler } from './handlers/calendar';
import { handler as lockDateHandler } from './handlers/lock-date';
import { handler as unlockDateHandler } from './handlers/unlock-date';
import { handler as submitSongHandler } from './handlers/submit-song';
import { handler as statusHandler } from './handlers/status';
import { handler as reviewsHandler } from './handlers/reviews';
import { handler as cancelSubmissionHandler } from './handlers/cancel-submission';

/**
 * Main entry point for Ben AM API Lambda
 * Routes requests to appropriate handlers based on path and method
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Remove stage prefix from path if present (e.g., /default/calendar -> /calendar)
  let path = event.path || event.resource;
  if (path.startsWith('/default/')) {
    path = path.replace('/default', '');
  }
  
  const method = event.httpMethod;

  try {
    // Route to appropriate handler
    if (path === '/calendar' && method === 'GET') {
      return await calendarHandler(event);
    }

    if (path === '/lock-date' && method === 'POST') {
      return await lockDateHandler(event);
    }

    if (path === '/unlock-date' && method === 'POST') {
      return await unlockDateHandler(event);
    }

    if (path === '/submit-song' && method === 'POST') {
      return await submitSongHandler(event);
    }

    if (path.startsWith('/status/') && method === 'GET') {
      return await statusHandler(event);
    }

    if (path === '/reviews' && method === 'POST') {
      return await reviewsHandler(event);
    }

    if (path === '/cancel-submission' && method === 'POST') {
      return await cancelSubmissionHandler(event);
    }

    // Handle OPTIONS for CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        },
        body: '',
      };
    }

    // No matching route
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Route not found',
      }),
    };

  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
}
