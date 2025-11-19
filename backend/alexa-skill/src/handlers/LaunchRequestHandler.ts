import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
  youtubeURL: string;
  s3SongKey: string;
  thumbnailS3Key?: string;
  djName: string;
  djType: 'recorded' | 'tts';
  djMessage?: string;
  s3DJKey?: string;
  friendEmail?: string;
}

/**
 * LaunchRequestHandler - Triggered when Alexa Routine starts the skill
 * Fetches today's song and starts playback
 */
export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Fetch song for today
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `SONG#${today}`,
        },
      }));

      let song: SongEntry | undefined = result.Items?.[0] as SongEntry;

      // If no song for today, pick a random past entry
      if (!song) {
        const scanResult = await docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'begins_with(PK, :prefix)',
          ExpressionAttributeValues: {
            ':prefix': 'SONG#',
          },
        }));

        const songs = scanResult.Items as SongEntry[];
        if (songs && songs.length > 0) {
          song = songs[Math.floor(Math.random() * songs.length)];
        }
      }

      if (!song) {
        return handlerInput.responseBuilder
          .speak('Sorry, no songs are available yet. Ask your friends to add some!')
          .withShouldEndSession(true)
          .getResponse();
      }

      // Generate pre-signed URL for the song (24 hour expiry)
      const songUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: song.s3SongKey,
        }),
        { expiresIn: 86400 } // 24 hours
      );

      // Store song info in session for later use
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      sessionAttributes.currentSong = song;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      // Play the song using AudioPlayer
      return handlerInput.responseBuilder
        .speak(`Good morning! Here's your wake up song: ${song.songTitle} from ${song.djName}`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          songUrl,
          song.date, // Token for tracking
          0, // Offset
          undefined // Expected previous token
        )
        .withShouldEndSession(true)
        .getResponse();

    } catch (error) {
      console.error('Error in LaunchRequestHandler:', error);
      return handlerInput.responseBuilder
        .speak('Sorry, there was an error playing your wake up song.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};
