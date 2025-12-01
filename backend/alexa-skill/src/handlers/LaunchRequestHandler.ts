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
 * LaunchRequestHandler - Triggered when Alexa Routine starts the skill
 * Fetches today's song and starts playback of the combined audio file
 * (song + DJ message + optional review prompt all in one MP3)
 */
export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    console.log('=== LaunchRequestHandler called ===');
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('Today\'s date:', today);
      
      // Fetch song for today
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `SONG#${today}`,
        },
      }));

      let song: SongEntry | undefined = result.Items?.[0] as SongEntry;
      console.log('Query result items count:', result.Items?.length || 0);
      console.log('Song found:', song ? 'YES' : 'NO');
      if (song) {
        console.log('Song details:', JSON.stringify(song, null, 2));
      }

      // If no song for today, pick a random past entry
      if (!song) {
        console.log('No song for today, scanning for past songs...');
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
      
      console.log('Pre-signed song URL generated');

      // Encode song data in token for potential use in AudioPlayer events
      const songToken = JSON.stringify({
        type: 'combined-audio',
        date: song.date,
        songTitle: song.songTitle,
        djName: song.djName,
        friendEmail: song.friendEmail
      });

      // Use AudioPlayer to play the combined MP3 (song + DJ message + review prompt)
      // This provides better audio quality than SSML <audio> tags
      return handlerInput.responseBuilder
        .speak(`Good morning! Here's your wake up song.`)
        .addAudioPlayerPlayDirective(
          'REPLACE_ALL',
          songUrl,
          songToken,
          0, // Offset - start from beginning
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
