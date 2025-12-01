import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
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
  s3SongKey: string; // Original song audio only
  s3CombinedKey?: string; // Combined audio: song + DJ message + optional review prompt (Alexa plays this)
  thumbnailS3Key?: string;
  djName: string;
  djType: 'recorded' | 'tts';
  djMessage?: string;
  s3DJKey?: string;
  friendEmail?: string;
}

/**
 * PlayTodaysSongHandler - Custom intent handler for playing today's song
 * Same functionality as LaunchRequest but triggered by voice commands
 * Plays the combined audio file (song + DJ message + optional review prompt)
 */
export const PlayTodaysSongHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request as IntentRequest).intent.name === 'PlayTodaysSongIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    console.log('=== PlayTodaysSongHandler called ===');
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

      // Check if song has been processed - prefer s3CombinedKey, fallback to s3SongKey
      const audioKey = song.s3CombinedKey || song.s3SongKey;
      if (!audioKey) {
        return handlerInput.responseBuilder
          .speak('Your wake up song is still being processed. Please try again in a few minutes.')
          .withShouldEndSession(true)
          .getResponse();
      }

      console.log('Playing audio file:', audioKey);
      console.log('Using s3CombinedKey:', !!song.s3CombinedKey);

      // Generate pre-signed URL for the combined audio file (24 hour expiry)
      const songUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: audioKey,
        }),
        { expiresIn: 86400 } // 24 hours
      );

      // Encode song data in token for AudioPlayer events
      const songToken = JSON.stringify({
        type: 'combined-audio',
        date: song.date,
        songTitle: song.songTitle,
        djName: song.djName,
        friendEmail: song.friendEmail
      });

      // Play the combined audio using AudioPlayer (better quality than SSML <audio>)
      return handlerInput.responseBuilder
        .speak(`Here's your wake up song: ${song.songTitle} from ${song.djName}`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          songUrl,
          songToken,
          0, // Offset
          undefined // Expected previous token
        )
        .withShouldEndSession(true)
        .getResponse();

    } catch (error) {
      console.error('Error in PlayTodaysSongHandler:', error);
      return handlerInput.responseBuilder
        .speak('Sorry, there was an error playing your wake up song.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};
