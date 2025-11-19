import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, interfaces } from 'ask-sdk-model';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const S3_BUCKET = process.env.S3_BUCKET!;

interface SongEntry {
  djType: 'recorded' | 'tts';
  djMessage?: string;
  s3DJKey?: string;
  djName: string;
}

/**
 * AudioPlayerEventHandler - Handles AudioPlayer playback events
 * When song finishes, play the DJ message
 */
export const AudioPlayerEventHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackNearlyFinished'
      || handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackFinished';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    const request = handlerInput.requestEnvelope.request;
    
    // Only handle when song finishes
    if (request.type !== 'AudioPlayer.PlaybackFinished') {
      return handlerInput.responseBuilder.getResponse();
    }

    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const song: SongEntry = sessionAttributes.currentSong;

      if (!song) {
        return handlerInput.responseBuilder
          .speak('Hope you enjoyed your wake-up song! Have a great day!')
          .withShouldEndSession(true)
          .getResponse();
      }

      // Play DJ message based on type
      if (song.djType === 'recorded' && song.s3DJKey) {
        // Play recorded DJ message from S3
        const djUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: song.s3DJKey,
          }),
          { expiresIn: 3600 }
        );

        return handlerInput.responseBuilder
          .addAudioPlayerPlayDirective(
            'REPLACE_ALL',
            djUrl,
            'dj-message',
            0,
            undefined // Expected previous token
          )
          .withShouldEndSession(true)
          .getResponse();

      } else if (song.djType === 'tts' && song.djMessage) {
        // Use Text-to-Speech for DJ message with SSML
        const ssml = `<speak><prosody rate="95%">${escapeSSML(song.djMessage)}</prosody></speak>`;
        
        return handlerInput.responseBuilder
          .speak(ssml)
          .withShouldEndSession(false) // Keep session open for review prompt
          .getResponse();

      } else {
        // No DJ message, just end
        return handlerInput.responseBuilder
          .speak(`That was ${song.djName}'s pick! Have a great day!`)
          .withShouldEndSession(true)
          .getResponse();
      }

    } catch (error) {
      console.error('Error in AudioPlayerEventHandler:', error);
      return handlerInput.responseBuilder
        .speak('Have a great day!')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

/**
 * Escape special XML characters for SSML
 */
function escapeSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
