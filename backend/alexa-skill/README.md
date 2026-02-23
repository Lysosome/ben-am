# Ben AM Alexa Skill

The Ben AM Alexa Skill is the alarm component of the Ben AM wake-up music system. It plays a combined audio file (song + DJ message + optional review prompt) at 7 AM, and allows users to leave text-based reviews via voice.

## How It Works

### Audio Flow

1. **Web App Submission**: Friend picks a song and records/writes a DJ message
2. **Backend Processing**: YouTube-DL Lambda creates a combined MP3:
   - Song audio (trimmed from YouTube)
   - DJ message (Polly TTS or recorded audio)
   - Review prompt TTS: "To leave a review for [DJ], say Alexa, Leave a Review" (if email provided)
3. **Alexa Playback**: Skill uses AudioPlayer to play the combined MP3 in high quality
4. **Review Flow**: User says "Alexa, leave a review" → speaks review → sent via email

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUDIO CREATION (Backend)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  YouTube ──► yt-dlp ──► song.mp3 ─┐                                │
│                                    │                                │
│  DJ Message ──► Polly ──► dj.mp3 ─┼──► ffmpeg ──► combined.mp3 ──► S3
│       OR                           │                                │
│  S3 Recording ─────────► dj.mp3 ──┤                                │
│                                    │                                │
│  Review Prompt ──► Polly ──► review.mp3 (if email)                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        ALEXA PLAYBACK                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  7 AM Routine ──► LaunchRequest ──► DynamoDB (get song)            │
│                        │                                            │
│                        ▼                                            │
│                   AudioPlayer.Play(combined.mp3 from S3)           │
│                        │                                            │
│                        ▼                                            │
│              Song plays... DJ message plays... Review prompt plays  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        REVIEW FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User: "Alexa, leave a review"                                      │
│                        │                                            │
│                        ▼                                            │
│  LeaveReviewIntent ──► "What's your review for [song] from [DJ]?"  │
│                        │                                            │
│                        ▼                                            │
│  User speaks review (captured via AMAZON.SearchQuery slot)          │
│                        │                                            │
│                        ▼                                            │
│  CaptureReviewIntent ──► SES email to DJ                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
alexa-skill/
├── src/
│   ├── index.ts                          # Main skill entry point
│   └── handlers/
│       ├── LaunchRequestHandler.ts       # 7 AM trigger - plays combined audio
│       ├── PlayTodaysSongHandler.ts      # "Play today's song" - same as launch
│       ├── ReviewHandler.ts              # Leave/capture review via text
│       ├── SkipIntentHandler.ts          # Skip to next song
│       ├── BuiltInIntentHandlers.ts      # Pause, Resume, Stop, Help
│       └── SessionEndedRequestHandler.ts # Cleanup
├── models/
│   └── en-US.json                        # Interaction model with intents
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript configuration
└── README.md                             # This file
```

## Handler Responsibilities

### LaunchRequestHandler
- **Trigger**: Alexa Routine starts the skill at 7 AM
- **Logic**: 
  - Fetches today's song from DynamoDB (\`SONG#YYYY-MM-DD\`)
  - Falls back to random past song if today is empty
  - Generates pre-signed S3 URL for combined audio (24-hour expiry)
  - Uses \`addAudioPlayerPlayDirective()\` to play high-quality audio
  - Ends session immediately (review handled separately)

### PlayTodaysSongHandler
- **Trigger**: User says "Alexa, play today's song"
- **Logic**: Same as LaunchRequestHandler

### LeaveReviewIntentHandler
- **Trigger**: User says "Alexa, leave a review" (from idle, not within skill session)
- **Logic**:
  - Finds today's song (or most recent song with email)
  - Asks: "What's your one sentence review for [song] from [DJ]?"
  - Keeps session open to capture response

### CaptureReviewIntentHandler
- **Trigger**: User speaks their review (after LeaveReviewIntent)
- **Logic**:
  - Captures free-form speech via \`AMAZON.SearchQuery\` slot
  - Sends email to DJ via SES with the transcribed review
  - Ends session

## Alexa Developer Console Setup

### Required Changes for New Review Flow

After deploying the Lambda code, you **must** update the interaction model in the Alexa Developer Console:

#### 1. Add LeaveReviewIntent

Go to **Build** → **Intents** → **Add Intent**:

- **Intent Name**: \`LeaveReviewIntent\`
- **Sample Utterances**:
  ```
  leave a review
  leave review
  leave a message
  send a review
  review
  give feedback
  send feedback
  leave feedback
  ```

#### 2. Add CaptureReviewIntent with Slot

Go to **Build** → **Intents** → **Add Intent**:

- **Intent Name**: \`CaptureReviewIntent\`
- **Slots**:
  - Name: \`reviewText\`
  - Type: \`AMAZON.SearchQuery\`
- **Sample Utterances**:
  ```
  {reviewText}
  ```

#### 3. Save and Build

1. Click **Save Model**
2. Click **Build Model**
3. Wait for build to complete (~1-2 minutes)

### Complete Interaction Model

You can also replace the entire model via **JSON Editor**:

```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "ben am",
      "intents": [
        { "name": "AMAZON.CancelIntent", "samples": [] },
        { "name": "AMAZON.StopIntent", "samples": [] },
        { "name": "AMAZON.PauseIntent", "samples": [] },
        { "name": "AMAZON.ResumeIntent", "samples": [] },
        {
          "name": "AMAZON.NextIntent",
          "samples": ["skip", "next", "skip this song", "skip the song", "next song"]
        },
        { "name": "AMAZON.YesIntent", "samples": [] },
        { "name": "AMAZON.NoIntent", "samples": [] },
        { "name": "AMAZON.HelpIntent", "samples": [] },
        {
          "name": "PlayTodaysSongIntent",
          "slots": [],
          "samples": [
            "play today's song",
            "play my wake up song",
            "play the song",
            "start the alarm",
            "wake me up",
            "play my song",
            "start"
          ]
        },
        {
          "name": "LeaveReviewIntent",
          "slots": [],
          "samples": [
            "leave a review",
            "leave review",
            "leave a message",
            "send a review",
            "review",
            "give feedback",
            "send feedback",
            "leave feedback"
          ]
        },
        {
          "name": "CaptureReviewIntent",
          "slots": [
            {
              "name": "reviewText",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": ["{reviewText}"]
        }
      ],
      "types": []
    }
  }
}
```

### Endpoint Configuration

1. Go to **Build** → **Endpoint**
2. Select **AWS Lambda ARN**
3. Set Default Region to your Lambda ARN:
   - Staging: \`arn:aws:lambda:us-east-1:ACCOUNT:function:ben-am-staging-alexa-skill\`
   - Production: \`arn:aws:lambda:us-east-1:ACCOUNT:function:ben-am-alexa-skill\`

### Audio Player Interface

1. Go to **Build** → **Interfaces**
2. Enable **Audio Player**
3. Save and rebuild model

## Development Workflow

### Local Development with Alexa Skill Testing

You can't run Alexa skills fully locally, but you can test the Lambda logic:

1. **Build the skill**:
   ```bash
   cd backend/alexa-skill
   npm install
   npm run build
   ```

2. **Test Lambda handler locally** (using AWS SAM Local):
   ```bash
   cd ../../  # Back to project root
   sam local invoke AlexaSkillFunction -e backend/alexa-skill/test-events/launch-request.json
   ```

3. **Use Alexa Developer Console Test Simulator**:
   - Go to https://developer.amazon.com/alexa/console/ask
   - Select your "Ben AM" skill
   - Click "Test" tab
   - Enable testing for "Development"
   - Type or speak: "Open Ben AM" (or your invocation name)
   - See Lambda logs in CloudWatch

### Iterative Development Cycle

**Recommended workflow for fastest iteration:**

1. **Make code changes** in \`backend/alexa-skill/src/\`
2. **Build TypeScript**:
   ```bash
   npm run build
   ```
3. **Deploy to Lambda** (staging):
   ```bash
   cd ../../infra
   terraform workspace select staging
   terraform apply -target=aws_lambda_function.alexa_skill -auto-approve
   ```
4. **Test immediately** in Alexa Developer Console
   - No need to redeploy the skill interaction model unless you change intents/slots
   - Lambda code updates are instant
5. **Check CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/ben-am-staging-alexa-skill --follow
   ```

**When to update Alexa Developer Console:**
- When you add new intents (like \`LeaveReviewIntent\`, \`CaptureReviewIntent\`)
- When you add/modify slots
- When you change sample utterances
- Go to "Build" tab → JSON Editor → paste updated model → Save → Build Model

## Deployment

### To Staging

```bash
cd backend/alexa-skill
npm run build

cd ../../infra
terraform workspace select staging
terraform apply -target=aws_lambda_function.alexa_skill -auto-approve
```

### To Production

```bash
cd backend/alexa-skill
npm run build

cd ../../infra
terraform workspace select default
terraform apply -target=aws_lambda_function.alexa_skill -auto-approve
```

**Post-deployment steps:**
1. Update interaction model in Alexa Developer Console (if intents changed)
2. Test in Alexa Developer Console
3. Check CloudWatch logs for errors

## Environment Variables

Set in Terraform (\`infra/lambda.tf\`):

| Variable | Description |
|----------|-------------|
| \`TABLE_NAME\` | DynamoDB table name (e.g., \`ben-am-calendar\`) |
| \`S3_BUCKET\` | S3 bucket for audio files (e.g., \`ben-am-assets-...\`) |
| \`SES_EMAIL_SENDER\` | Verified SES email for sending reviews |

## Permissions Required

The Lambda IAM role needs:
- **DynamoDB**: \`GetItem\`, \`Query\`, \`Scan\` on \`ben-am-calendar\` table
- **S3**: \`GetObject\` on \`ben-am-assets-*\` bucket (for audio files)
- **SES**: \`SendEmail\`, \`SendRawEmail\` (for sending review emails)

These are configured in \`infra/iam.tf\`.

## Troubleshooting

### "Sorry, there was an error"
- Check CloudWatch logs: \`/aws/lambda/ben-am-alexa-skill\`
- Common issues:
  - Song S3 key doesn't exist
  - Pre-signed URL expired (shouldn't happen with 24h expiry)
  - DynamoDB table empty

### Song doesn't play
- Verify S3 object exists and Lambda has \`GetObject\` permission
- Check pre-signed URL is valid (test in browser)
- Ensure MP3 is valid format (not corrupted)
- Verify Audio Player interface is enabled in Alexa Developer Console

### Review not working
- Verify the \`LeaveReviewIntent\` and \`CaptureReviewIntent\` are in the interaction model
- Check that \`AMAZON.SearchQuery\` slot is configured for \`reviewText\`
- Rebuild the model after changes
- Check CloudWatch logs for SES errors

### "Alexa, leave a review" not recognized
- Make sure you've added \`LeaveReviewIntent\` to the model
- Rebuild the model in Alexa Developer Console
- Try variations: "leave review", "give feedback", "send a review"

## Key Changes from Previous Version

### What Changed

1. **Combined Audio**: Song, DJ message, and review prompt are now pre-combined into one MP3 by the youtube-dl Lambda (using Amazon Polly for TTS)

2. **AudioPlayer Instead of SSML**: Using \`addAudioPlayerPlayDirective()\` for better audio quality (SSML \`<audio>\` had quality limitations)

3. **Text-Based Reviews**: Reviews are now transcribed text sent via email, not audio recordings (simpler and more reliable)

4. **Review Flow Changed**: 
   - Old: Prompt within skill session after song
   - New: Audio prompt in combined MP3, user says "Alexa, leave a review" from idle

5. **New Intents Required**:
   - \`LeaveReviewIntent\` - triggers review flow
   - \`CaptureReviewIntent\` - captures spoken review text

### Why These Changes

- **Alexa Limitations**: Cannot play separate audio files in sequence with good quality
- **Session Management**: Keeping sessions open for long audio was unreliable
- **Simplicity**: Text reviews are easier to process and deliver than audio recordings
