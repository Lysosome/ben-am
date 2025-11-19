import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({});
const sesClient = new SESClient({});

const S3_BUCKET = process.env.S3_BUCKET!;
const SES_EMAIL_SENDER = process.env.SES_EMAIL_SENDER!;

/**
 * POST /reviews
 * Upload review recording and send email to friend
 * Body: { date, userId, audioData (base64), friendEmail }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { date, userId, audioData, friendEmail } = body;

    if (!date || !userId || !audioData || !friendEmail) {
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

    const reviewId = uuidv4();
    const s3Key = `reviews/${date}-${userId}-${reviewId}.mp3`;

    // Upload review audio to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: Buffer.from(audioData, 'base64'),
      ContentType: 'audio/mpeg',
    }));

    // Generate public URL (or pre-signed URL)
    const reviewURL = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;

    // Send email to friend
    await sesClient.send(new SendEmailCommand({
      Source: SES_EMAIL_SENDER,
      Destination: {
        ToAddresses: [friendEmail],
      },
      Message: {
        Subject: {
          Data: `Review for your Ben AM wake-up song on ${date}`,
        },
        Body: {
          Html: {
            Data: `
              <h2>You've got feedback!</h2>
              <p>Your friend left a voice review for the song you picked for ${date}.</p>
              <p>Listen to their review: <a href="${reviewURL}">Download Recording</a></p>
              <p>Thanks for being an awesome DJ!</p>
              <hr>
              <p><small>Powered by Ben AM</small></p>
            `,
          },
          Text: {
            Data: `You've got feedback!\n\nYour friend left a voice review for the song you picked for ${date}.\n\nListen at: ${reviewURL}\n\nThanks for being an awesome DJ!`,
          },
        },
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
        message: 'Review submitted and email sent',
      }),
    };

  } catch (error) {
    console.error('Error in reviews handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to submit review',
      }),
    };
  }
}
