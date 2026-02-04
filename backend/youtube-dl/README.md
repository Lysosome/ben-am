# Ben AM YouTube-DL Lambda

This Lambda function handles downloading YouTube videos, converting them to MP3, and combining them with DJ messages to create a single audio file for Alexa playback.

## Overview

The YouTube-DL Lambda is invoked asynchronously by the API when a user submits a song. It performs the following steps:

1. **Download** - Uses yt-dlp to download and extract audio from YouTube
2. **Trim** - Uses ffmpeg to trim the audio to the specified start/end times
3. **Generate DJ Message** - Either via Amazon Polly TTS or by downloading a recorded message from S3
4. **Generate Review Prompt** (optional) - If the DJ provided an email, generates TTS: "To leave a review for [DJ NAME], say Alexa, Leave a Review"
5. **Concatenate** - Uses ffmpeg to combine song + DJ message + review prompt into one MP3
6. **Upload** - Stores the combined audio and thumbnail in S3
7. **Update Status** - Updates DynamoDB with completion status

## ⚠️ Maintenance: yt-dlp Updates

**Critical**: YouTube frequently changes their API, breaking yt-dlp. Update every 1-2 weeks or when downloads fail.

```bash
# From project root
npm run update:yt-dlp-full

# Then update infra/lambda.tf with new layer ARN and:
cd infra && terraform apply
```

See [../../lambda-layers/README.md](../../lambda-layers/README.md) for details.

## Audio Processing Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  YouTube Video  │ --> │   yt-dlp/ffmpeg │ --> │   song.mp3      │
└─────────────────┘     │   (download +   │     └────────┬────────┘
                        │    trim)        │              │
                        └─────────────────┘              │
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│  DJ Message     │ --> │  Amazon Polly   │ --> │   dj.mp3        │
│  (TTS text)     │     │  (TTS)          │     └────────┬────────┘
└─────────────────┘     └─────────────────┘              │
        OR                                               │
┌─────────────────┐                             ┌────────▼────────┐
│  DJ Recording   │ --------------------------> │   dj.mp3        │
│  (S3 download)  │                             └────────┬────────┘
└─────────────────┘                                      │
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│  Review Prompt  │ --> │  Amazon Polly   │ --> │  review.mp3     │
│  (if email set) │     │  (TTS)          │     └────────┬────────┘
└─────────────────┘     └─────────────────┘              │
                                                         │
                        ┌─────────────────┐     ┌────────▼────────┐
                        │     ffmpeg      │ <-- │  All MP3 files  │
                        │   (concat)      │     └─────────────────┘
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  combined.mp3   │ --> S3: songs/{date}/{jobId}.mp3
                        └─────────────────┘
```

## Amazon Polly TTS

The Lambda uses Amazon Polly to generate text-to-speech audio:

- **Engine**: Standard (cost-effective)
- **Voice**: Matthew (US English, male)
- **Format**: MP3 at 22050 Hz
- **Use Cases**:
  - DJ messages when `djType === 'tts'`
  - Review prompt: "To leave a review for [DJ NAME], say Alexa, Leave a Review"

### Polly Pricing
- Standard voices: ~$4 per 1 million characters
- Average DJ message: ~50 characters = $0.0002 per message
- Extremely cost-effective for this use case

## Dependencies

### Lambda Layers (Required)
- **yt-dlp-binary**: Contains the yt-dlp executable
- **ffmpeg-binary**: Contains ffmpeg for audio processing
- **youtube-cookies**: Contains cookies.txt for authenticated YouTube access

### npm Dependencies
- `@aws-sdk/client-dynamodb` - DynamoDB operations
- `@aws-sdk/lib-dynamodb` - DynamoDB Document Client
- `@aws-sdk/client-s3` - S3 operations
- `@aws-sdk/client-polly` - Amazon Polly TTS
- `uuid` - Generate unique job IDs

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TABLE_NAME` | DynamoDB table name (e.g., `ben-am-calendar`) |
| `S3_BUCKET` | S3 bucket for assets (e.g., `ben-am-assets-...`) |
| `MAX_SONG_DURATION_SECONDS` | Maximum allowed clip duration (default: 600) |
| `YT_DLP_BIN` | Path to yt-dlp binary (default: `/opt/bin/yt-dlp`) |
| `FFMPEG_BIN` | Path to ffmpeg binary (default: `/opt/bin/ffmpeg`) |
| `COOKIES_FILE` | Path to YouTube cookies (default: `/opt/cookies/cookies.txt`) |

## IAM Permissions Required

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject"
  ],
  "Resource": [
    "arn:aws:s3:::BUCKET/songs/*",
    "arn:aws:s3:::BUCKET/thumbnails/*",
    "arn:aws:s3:::BUCKET/temp/*"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject"
  ],
  "Resource": [
    "arn:aws:s3:::BUCKET/dj-messages/*"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:UpdateItem",
    "dynamodb:GetItem"
  ],
  "Resource": "arn:aws:dynamodb:REGION:ACCOUNT:table/TABLE_NAME"
},
{
  "Effect": "Allow",
  "Action": [
    "polly:SynthesizeSpeech"
  ],
  "Resource": "*"
}
```

## Event Payload

```typescript
interface YouTubeDownloadEvent {
  jobId: string;      // Unique job identifier
  date: string;       // YYYY-MM-DD format
  youtubeURL: string; // Full YouTube URL
  startTime?: number; // Clip start time in seconds
  endTime?: number;   // Clip end time in seconds
  maxDuration: number; // Maximum allowed duration
}
```

## Output

### S3 Objects Created
- `songs/{date}/{jobId}.mp3` - Combined audio file (song + DJ message + review prompt)
- `thumbnails/{date}/{jobId}.jpg` - Video thumbnail

### DynamoDB Updates
- `processingStatus`: `pending` → `processing` → `completed` (or `failed`)
- `progress`: 0-100 percentage
- `s3SongKey`: S3 key for the combined audio
- `thumbnailS3Key`: S3 key for the thumbnail
- `duration`: Clip duration in seconds

## Development

### Build
```bash
cd backend/youtube-dl
npm install
npm run build
```

The build uses **esbuild** to bundle all dependencies (except AWS SDK which is provided by Lambda) into a single `dist/index.js` file (~1.7MB). This eliminates the need for node_modules in the deployment package.

- `npm run build` - Production build with esbuild (for deployment)
- `npm run build:tsc` - TypeScript build (for type checking)

### Local Testing
```bash
# Test download functionality (requires local yt-dlp and ffmpeg)
node test-download.js
```

### Deploy
```bash
cd ../../infra
terraform workspace select staging  # or default for prod
terraform apply -target=aws_lambda_function.youtube_dl
```

## Troubleshooting

### "yt-dlp failed with code X"
- Check CloudWatch logs for detailed error
- Verify cookies.txt is valid and not expired
- YouTube may have changed their API - update yt-dlp layer

### "Polly did not return audio stream"
- Check IAM permissions for `polly:SynthesizeSpeech`
- Verify text is not empty or too long (Polly has limits)

### "ffmpeg concat failed"
- Ensure all input files exist and are valid MP3s
- Check that ffmpeg binary is accessible in Lambda layer
- Verify enough ephemeral storage (2GB configured)

### Processing takes too long
- Lambda timeout is 5 minutes (300s)
- Long videos may exceed timeout - enforce max duration on API
- Consider using Lambda Provisioned Concurrency for cold starts
