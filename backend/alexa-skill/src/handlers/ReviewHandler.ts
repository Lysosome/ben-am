import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sesClient = new SESClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const SES_EMAIL_SENDER = process.env.SES_EMAIL_SENDER!;

interface SongEntry {
  PK: string;
  date: string;
  songTitle: string;
  djName: string;
  friendEmail?: string;
}

/**
 * LeaveReviewIntentHandler - Triggered when user says "Alexa, leave a review"
 * This can be invoked from idle (not within a session) after hearing the audio prompt
 * Asks the user for their one-sentence review and opens the mic
 */
export const LeaveReviewIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'LeaveReviewIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    console.log('=== LeaveReviewIntentHandler called ===');
    
    try {
      // Get today's date to find the song
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Fetch today's song from DynamoDB
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `SONG#${today}`,
        },
      }));

      let song: SongEntry | undefined = result.Items?.[0] as SongEntry;

      // If no song for today, try to find the most recent song with an email
      if (!song || !song.friendEmail) {
        console.log('No song with email for today, scanning for recent songs...');
        const scanResult = await docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'begins_with(PK, :prefix) AND attribute_exists(friendEmail)',
          ExpressionAttributeValues: {
            ':prefix': 'SONG#',
          },
        }));

        const songs = (scanResult.Items as SongEntry[])?.filter(s => s.friendEmail);
        if (songs && songs.length > 0) {
          // Sort by date descending and get most recent
          songs.sort((a, b) => b.date.localeCompare(a.date));
          song = songs[0];
        }
      }

      if (!song || !song.friendEmail) {
        return handlerInput.responseBuilder
          .speak('Sorry, there\'s no song available to review right now. The DJ didn\'t leave their email address.')
          .withShouldEndSession(true)
          .getResponse();
      }

      console.log('Found song for review:', JSON.stringify({
        date: song.date,
        songTitle: song.songTitle,
        djName: song.djName,
        friendEmail: song.friendEmail
      }));

      // Store song info in session for the CaptureReviewIntent to use
      handlerInput.attributesManager.setSessionAttributes({
        reviewSong: {
          date: song.date,
          songTitle: song.songTitle,
          djName: song.djName,
          friendEmail: song.friendEmail
        }
      });

      // Ask for the review and open the mic
      const prompt = `What's your one sentence review for today's song, ${song.songTitle}, from ${song.djName}?`;
      const reprompt = 'Go ahead, tell me your review.';

      return handlerInput.responseBuilder
        .speak(prompt)
        .reprompt(reprompt)
        .withShouldEndSession(false) // Keep session open to capture the review
        .getResponse();

    } catch (error) {
      console.error('Error in LeaveReviewIntentHandler:', error);
      return handlerInput.responseBuilder
        .speak('Sorry, there was an error. Please try again later.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

/**
 * CaptureReviewIntentHandler - Captures the user's spoken review text
 * Triggered after LeaveReviewIntent opens the mic
 * Uses AMAZON.SearchQuery slot to capture free-form speech
 */
export const CaptureReviewIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'CaptureReviewIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    console.log('=== CaptureReviewIntentHandler called ===');
    
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const reviewSong = sessionAttributes.reviewSong;

      if (!reviewSong || !reviewSong.friendEmail) {
        return handlerInput.responseBuilder
          .speak('Sorry, I lost track of which song you\'re reviewing. Please try saying "leave a review" again.')
          .withShouldEndSession(true)
          .getResponse();
      }

      // Get the review text from the slot
      const request = handlerInput.requestEnvelope.request as IntentRequest;
      const reviewText = request.intent.slots?.reviewText?.value;

      if (!reviewText) {
        return handlerInput.responseBuilder
          .speak('I didn\'t catch that. What\'s your review?')
          .reprompt('Go ahead, tell me your one sentence review.')
          .withShouldEndSession(false)
          .getResponse();
      }

      console.log('Review captured:', reviewText);
      console.log('Sending to:', reviewSong.friendEmail);

      // Send email to the DJ
      await sesClient.send(new SendEmailCommand({
        Source: SES_EMAIL_SENDER,
        Destination: {
          ToAddresses: [reviewSong.friendEmail],
        },
        Message: {
          Subject: {
            Data: `Review for your wake-up song: ${reviewSong.songTitle}`,
          },
          Body: {
            Html: {
              Data: `
                <h2>You've got feedback! 🎵</h2>
                <p>Your friend left a review for the song you picked:</p>
                <p><strong>Song:</strong> ${reviewSong.songTitle}</p>
                <p><strong>Date:</strong> ${reviewSong.date}</p>
                <blockquote style="font-size: 18px; font-style: italic; border-left: 4px solid #1db954; padding-left: 16px; margin: 20px 0;">
                  "${reviewText}"
                </blockquote>
                <p>Thanks for being an awesome DJ! 🎧</p>
              `,
            },
            Text: {
              Data: `You've got feedback!\n\nYour friend left a review for: ${reviewSong.songTitle}\nDate: ${reviewSong.date}\n\nReview: "${reviewText}"\n\nThanks for being an awesome DJ!`,
            },
          },
        },
      }));

      console.log('Review email sent successfully');

      return handlerInput.responseBuilder
        .speak(`Thanks! Your review has been sent to ${reviewSong.djName}. Have a great day!`)
        .withShouldEndSession(true)
        .getResponse();

    } catch (error) {
      console.error('Error in CaptureReviewIntentHandler:', error);
      return handlerInput.responseBuilder
        .speak('Sorry, there was an error sending your review. Please try again later.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

/**
 * FallbackReviewHandler - Captures any unmatched speech when user is in review mode
 * This handles the case where user just speaks their review without carrier phrases
 * Works by checking if we're in a review session (have reviewSong in session attributes)
 */
export const FallbackReviewHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    // Handle FallbackIntent when we're in a review session
    if (request.type === 'IntentRequest' && (request as IntentRequest).intent.name === 'AMAZON.FallbackIntent') {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      return !!sessionAttributes.reviewSong;
    }
    return false;
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    console.log('=== FallbackReviewHandler called (capturing review via fallback) ===');
    
    // Since FallbackIntent doesn't capture the actual speech, we need to ask again
    // but be more explicit about format
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const reviewSong = sessionAttributes.reviewSong;
    
    return handlerInput.responseBuilder
      .speak(`I didn't quite catch that. Please say your review starting with "my review is" followed by your thoughts.`)
      .reprompt('Say "my review is" followed by your one sentence review.')
      .withShouldEndSession(false)
      .getResponse();
  },
};

/**
 * NoReviewHandler - User declines to leave review (legacy, still useful for cancellation)
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
