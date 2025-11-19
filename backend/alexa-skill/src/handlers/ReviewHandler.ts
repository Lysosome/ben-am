import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({});
const sesClient = new SESClient({});

const S3_BUCKET = process.env.S3_BUCKET!;
const SES_EMAIL_SENDER = process.env.SES_EMAIL_SENDER!;

/**
 * ReviewIntentHandler - Captures user's voice review and emails it to friend
 * Triggered after DJ message plays when user says "Yes" to review prompt
 */
export const ReviewIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.YesIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    return handlerInput.responseBuilder
      .speak('Please share your feedback after the beep.')
      .addDirective({
        type: 'SendEvent',
        arguments: ['startRecording'],
      } as any)
      .withShouldEndSession(false)
      .getResponse();
  },
};

/**
 * CaptureReviewHandler - Processes recorded audio and sends email
 */
export const CaptureReviewHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'Alexa.Presentation.APL.UserEvent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const song = sessionAttributes.currentSong;

      if (!song || !song.friendEmail) {
        return handlerInput.responseBuilder
          .speak('Thank you for your feedback!')
          .withShouldEndSession(true)
          .getResponse();
      }

      // Get audio data from event (this is simplified - actual implementation depends on Alexa API)
      const audioData = (handlerInput.requestEnvelope.request as any).arguments?.[0];
      
      if (audioData) {
        // Generate unique filename
        const reviewId = uuidv4();
        const s3Key = `reviews/${song.date}-${reviewId}.mp3`;

        // Upload to S3
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: Buffer.from(audioData, 'base64'),
          ContentType: 'audio/mpeg',
        }));

        // Generate pre-signed URL for email attachment
        const reviewUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;

        // Send email to friend
        await sesClient.send(new SendEmailCommand({
          Source: SES_EMAIL_SENDER,
          Destination: {
            ToAddresses: [song.friendEmail],
          },
          Message: {
            Subject: {
              Data: `Review for your wake-up song: ${song.songTitle}`,
            },
            Body: {
              Html: {
                Data: `
                  <h2>You've got feedback!</h2>
                  <p>Your friend left a voice review for the song you picked:</p>
                  <p><strong>${song.songTitle}</strong></p>
                  <p>Listen to their review: <a href="${reviewUrl}">Download Recording</a></p>
                  <p>Thanks for being an awesome DJ!</p>
                `,
              },
              Text: {
                Data: `You've got feedback!\n\nYour friend left a voice review for: ${song.songTitle}\n\nListen at: ${reviewUrl}`,
              },
            },
          },
        }));
      }

      return handlerInput.responseBuilder
        .speak('Thanks for your feedback! Have a great day!')
        .withShouldEndSession(true)
        .getResponse();

    } catch (error) {
      console.error('Error in CaptureReviewHandler:', error);
      return handlerInput.responseBuilder
        .speak('Thanks for your feedback! Have a great day!')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

/**
 * NoReviewHandler - User declines to leave review
 */
export const NoReviewHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'AMAZON.NoIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    return handlerInput.responseBuilder
      .speak('No problem! Have a great day!')
      .withShouldEndSession(true)
      .getResponse();
  },
};
