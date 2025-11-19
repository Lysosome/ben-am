# Ben AM Backend

Node.js Lambda functions for the Ben AM project, implementing the Alexa Skill, REST API, and YouTube processing.

## Structure

```
backend/
├── alexa-skill/       # Alexa Skill Lambda
│   ├── src/
│   │   ├── handlers/  # Launch, AudioPlayer, Review handlers
│   │   └── index.ts   # Skill entry point
│   ├── dist/          # Compiled JavaScript
│   └── package.json
├── api/               # REST API Lambda
│   ├── src/
│   │   ├── handlers/  # calendar, lock-date, submit-song, status, reviews
│   │   ├── types/     # TypeScript interfaces
│   │   └── index.ts   # API router
│   ├── dist/          # Compiled JavaScript
│   └── package.json
└── youtube-dl/        # YouTube download/conversion Lambda
    ├── src/
    │   └── index.ts   # Download & process logic
    ├── dist/          # Compiled JavaScript
    └── package.json
```

## Building

From project root:

```bash
# Install dependencies
npm install

# Build all backend Lambda functions
npm run build:backend

# Or build individually
npm run build --workspace backend/alexa-skill
npm run build --workspace backend/api
npm run build --workspace backend/youtube-dl
```

Compiled JavaScript output goes to `dist/` in each Lambda directory.

## Alexa Skill Lambda

**File**: `backend/alexa-skill/src/index.ts`

### Handlers

- **LaunchRequestHandler** - Triggered by Alexa Routine at 7 AM
  - Fetches today's song from DynamoDB
  - Falls back to random past entry if no song for today
  - Plays MP3 via AudioPlayer with pre-signed S3 URL
  
- **AudioPlayerEventHandler** - Handles playback events
  - When song finishes, plays DJ message
  - Supports recorded MP3 or TTS with SSML
  
- **ReviewIntentHandler** - Captures user review
  - Prompts for voice feedback
  - Stores audio in S3
  - Emails friend via SES

### Environment Variables

- `TABLE_NAME` - DynamoDB table name
- `S3_BUCKET` - S3 bucket for assets
- `SES_EMAIL_SENDER` - Verified SES email address

## API Lambda

**File**: `backend/api/src/index.ts`

Routes requests to appropriate handlers based on path/method.

### Endpoints

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/calendar` | GET | `calendar.ts` | Fetch all songs and locks |
| `/lock-date` | POST | `lock-date.ts` | Lock date for 15 minutes |
| `/submit-song` | POST | `submit-song.ts` | Submit song & trigger processing |
| `/status/{id}` | GET | `status.ts` | Poll job status |
| `/reviews` | POST | `reviews.ts` | Upload review audio & email friend |

### Key Features

- **Date Locking**: 15-minute TTL prevents double-booking
- **Validation**: Enforces date format, duration limits, lock ownership
- **Async Processing**: Invokes youtube-dl Lambda, returns immediately
- **CORS Support**: Handles OPTIONS preflight requests

### Environment Variables

- `TABLE_NAME` - DynamoDB table
- `S3_BUCKET` - S3 bucket
- `SES_EMAIL_SENDER` - Email sender
- `YOUTUBE_DL_LAMBDA_ARN` - ARN of youtube-dl Lambda
- `DATE_LOCK_TTL_MINUTES` - Lock duration (default: 15)
- `MAX_SONG_DURATION_SECONDS` - Max clip length (default: 600)
- `MAX_DJ_RECORDING_SECONDS` - Max DJ recording (default: 60)

## YouTube-DL Lambda

**File**: `backend/youtube-dl/src/index.ts`

Downloads and converts YouTube videos to MP3, extracts thumbnails.

### Process Flow

1. Fetch video metadata (title, duration)
2. Validate duration constraints
3. Download audio with yt-dlp + ffmpeg
4. Extract thumbnail
5. Upload MP3 and thumbnail to S3
6. Update DynamoDB with completion status

### Requirements

**This Lambda requires external binaries** via Lambda layers:

- **yt-dlp** (or youtube-dl) - Video download
- **ffmpeg** - Audio conversion

These must be packaged as Lambda layers or bundled in deployment.

### Environment Variables

- `S3_BUCKET` - S3 bucket for assets
- `TABLE_NAME` - DynamoDB table
- `MAX_SONG_DURATION_SECONDS` - Max allowed duration

### Example Layer Setup

```bash
# Create yt-dlp layer
mkdir -p layer/bin
cd layer/bin
wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x yt-dlp
cd ..
zip -r ../yt-dlp-layer.zip .

# Create ffmpeg layer (use pre-built Lambda-compatible binary)
# See: https://github.com/shimberger/ffmpeg-lambda-layer
```

Then reference in `infra/lambda.tf`:

```hcl
resource "aws_lambda_layer_version" "yt_dlp" {
  filename   = "yt-dlp-layer.zip"
  layer_name = "yt-dlp"
  compatible_runtimes = ["nodejs20.x"]
}

resource "aws_lambda_layer_version" "ffmpeg" {
  filename   = "ffmpeg-layer.zip"
  layer_name = "ffmpeg"
  compatible_runtimes = ["nodejs20.x"]
}

# Then add to youtube_dl Lambda:
resource "aws_lambda_function" "youtube_dl" {
  # ... existing config ...
  layers = [
    aws_lambda_layer_version.yt_dlp.arn,
    aws_lambda_layer_version.ffmpeg.arn,
  ]
}
```

## Deployment

Backend Lambdas are deployed via Terraform (see `infra/`).

1. Build: `npm run build:backend`
2. Deploy: `cd infra && terraform apply`

Terraform automatically packages and uploads compiled code from `dist/` directories.

## Testing Locally

### Alexa Skill

Use Alexa Developer Console simulator or:

```bash
npm install -g ask-cli
ask dialog --locale en-US
```

### API Lambda

Use AWS SAM for local testing:

```bash
sam local start-api --template-file template.yaml
curl http://localhost:3000/calendar
```

### YouTube-DL Lambda

Test with sample event:

```bash
sam local invoke YouTubeDLFunction --event events/youtube-dl-event.json
```

## TypeScript Types

Shared types are defined in `api/src/types/models.ts`:

- `SongEntry` - DynamoDB song record
- `LockEntry` - Date lock record
- `SubmitSongRequest/Response` - API request/response shapes
- Environment variable interfaces

## Error Handling

All handlers include try/catch blocks and return appropriate HTTP status codes:

- `200` - Success
- `202` - Accepted (async processing started)
- `400` - Bad request (validation error)
- `403` - Forbidden (lock not held)
- `404` - Not found
- `409` - Conflict (date already taken)
- `500` - Internal server error

Errors are logged to CloudWatch and returned to client with sanitized messages.

## Notes

- Node.js 20.x runtime
- AWS SDK v3 (modular imports for smaller bundles)
- Strict TypeScript compilation
- All DynamoDB operations use DocumentClient
- S3 pre-signed URLs expire after 24 hours (songs) or 1 hour (thumbnails)
- SES emails use HTML + plain text multipart format
