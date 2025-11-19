# Ben AM Alexa Skill

The Ben AM Alexa Skill is the alarm component of the Ben AM wake-up music system. It plays a song selected by friends at 7 AM, includes a DJ message, and allows you to leave audio reviews for your friends.

## How It Works

### Alarm Flow

1. **Trigger**: An Alexa Routine runs the skill at 7 AM daily (configured in the Alexa app)
2. **Song Selection**: The skill fetches today's song from DynamoDB, or picks a random past song if none is set
3. **Playback**: Alexa plays the song using the AudioPlayer interface
4. **DJ Message**: After the song finishes (or you say "Alexa, skip"), the DJ message plays:
   - If a recorded message exists, it plays that audio file
   - Otherwise, it uses text-to-speech: "That was [song title]; picked by [friend name]."
5. **Review Capture**: If the friend provided an email, Alexa asks if you want to leave a review
   - Say "yes" to record a message
   - The audio recording is emailed to your friend via SES

### Architecture

```
Alexa Device → Alexa Service → Lambda (ben-am-alexa-skill)
                                   ↓
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
                DynamoDB          S3            SES
              (song data)    (audio files)   (email)
```

## Project Structure

```
alexa-skill/
├── src/
│   ├── index.ts                          # Main skill entry point
│   └── handlers/
│       ├── LaunchRequestHandler.ts       # Initial skill invocation (7 AM trigger)
│       ├── PlayTodaysSongHandler.ts      # Play/resume song playback
│       ├── AudioPlayerEventHandler.ts    # Handle song finished, errors, etc.
│       └── ReviewHandler.ts              # Capture and email reviews
├── package.json                          # Dependencies (ask-sdk-core, AWS SDK)
├── tsconfig.json                         # TypeScript configuration
└── README.md                             # This file
```

## Handler Responsibilities

### LaunchRequestHandler
- **Trigger**: Alexa Routine starts the skill
- **Logic**: 
  - Fetches today's song from DynamoDB (`SONG#YYYY-MM-DD`)
  - Falls back to random past song if today is empty
  - Generates pre-signed S3 URL for song audio (24-hour expiry)
  - Starts AudioPlayer playback
  - Stores song metadata in session for later handlers

### AudioPlayerEventHandler
- **Trigger**: Song finishes playing (`AudioPlayer.PlaybackFinished`)
- **Logic**:
  - Retrieves song info from session
  - Plays DJ message (recorded or TTS)
  - If friend provided email, prompts for review

### PlayTodaysSongHandler
- **Trigger**: User says "Alexa, play today's song"
- **Logic**: Similar to LaunchRequestHandler but manual invocation

### ReviewHandler
- **CaptureReviewHandler**: Records user's audio review
- **NoReviewHandler**: Skips review if user declines
- **Logic**: Uploads recording to S3 and sends email via SES

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

1. **Make code changes** in `backend/alexa-skill/src/`
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
   # View recent logs
   aws logs tail /aws/lambda/ben-am-staging-alexa-skill --follow
   ```

**When to update Alexa Developer Console:**
- Only if you add new intents, slots, or change the interaction model
- Go to "Build" tab → JSON Editor → paste updated model → Save → Build Model

### Testing Specific Features

**Test DJ Message Playback:**
- Upload a test recorded DJ message to S3: `dj-messages/2025-11-16/test.mp3`
- Update DynamoDB entry to reference it
- Trigger skill and let song finish

**Test Review Capture:**
- Ensure song entry has `friendEmail` set
- After DJ message, say "yes" when prompted for review
- Record a message
- Check SES sent email (and check spam folder!)

**Test Random Song Fallback:**
- Delete today's song from DynamoDB
- Launch skill
- Verify it picks a random past song

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
1. Test in Alexa Developer Console
2. Check CloudWatch logs for errors
3. If all looks good, submit skill for certification (if making it public)
   - Or keep it in "Development" stage for personal use

## Setting Up Staging vs. Production Environments

### Overview

Alexa doesn't have built-in "staging" and "production" environments, but you can simulate this using two separate skills that point to different Lambda functions. This is the recommended approach for safe testing before deploying to your live alarm.

### Two-Skill Approach

**Option A: Two Separate Skills (Recommended)**

Create two completely separate Alexa Skills in the Developer Console:

1. **Ben AM Staging** (Development/Test)
   - Skill ID: `amzn1.ask.skill.STAGING_ID`
   - Invocation: "ben am staging" or "test ben am"
   - Lambda: `ben-am-staging-alexa-skill`
   - Status: Development (never published)
   - Use: Daily development and testing

2. **Ben AM** (Production)
   - Skill ID: `amzn1.ask.skill.PRODUCTION_ID`
   - Invocation: "ben am"
   - Lambda: `ben-am-alexa-skill`
   - Status: Development or Live (if published publicly)
   - Use: Your actual 7 AM alarm

**Benefits:**
- Complete isolation between environments
- Can test without affecting your morning alarm
- Different invocation names prevent accidents
- Each skill connects to its own Lambda/DynamoDB/S3 environment

**Setup Steps:**

1. **Create Staging Skill**:
   - Go to https://developer.amazon.com/alexa/console/ask
   - Click "Create Skill"
   - Name: "Ben AM Staging"
   - Invocation: "ben am staging"
   - Model: Custom
   - Hosting: Provision your own
   - Follow setup steps below (use staging Lambda ARN)

2. **Create Production Skill**:
   - Repeat process
   - Name: "Ben AM"
   - Invocation: "ben am"
   - Use production Lambda ARN

3. **Configure Each Skill**:
   - Build tab → Endpoint → Set appropriate Lambda ARN
   - Test tab → Enable testing for Development
   - Both skills will appear on your Alexa devices automatically

**Option B: Single Skill with Lambda Aliases (Not Recommended)**

You could use one skill with Lambda aliases/versions, but this is more complex and doesn't provide full isolation. Stick with Option A.

### Linking Skills to Lambda Functions

**Staging Skill Configuration:**

1. Go to Alexa Developer Console → Ben AM Staging → Build tab
2. Click "Endpoint"
3. Select "AWS Lambda ARN"
4. Default Region: `arn:aws:lambda:us-east-1:668596205778:function:ben-am-staging-alexa-skill`
5. Copy the skill ID shown at the top
6. In your Lambda function (via AWS Console or Terraform), add trigger:
   - Trigger: Alexa Skills Kit
   - Skill ID: `amzn1.ask.skill.YOUR_STAGING_SKILL_ID`

**Production Skill Configuration:**

1. Same process, but use production Lambda ARN:
   - ARN: `arn:aws:lambda:us-east-1:668596205778:function:ben-am-alexa-skill`
   - Skill ID: `amzn1.ask.skill.YOUR_PRODUCTION_SKILL_ID`

**Terraform Configuration:**

Your Lambda functions already support multiple skill triggers. The Alexa Skills Kit trigger in `infra/lambda.tf` allows any skill ID by default. If you want to restrict to specific skills:

```hcl
resource "aws_lambda_permission" "alexa_skill" {
  statement_id  = "AllowExecutionFromAlexa"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alexa_skill.function_name
  principal     = "alexa-appkit.amazonaws.com"
  
  # Optional: Restrict to specific skill ID
  event_source_token = "amzn1.ask.skill.YOUR_SKILL_ID"
}
```

### Development Workflow with Two Skills

**Daily Development:**

1. Make code changes
2. Deploy to staging Lambda:
   ```bash
   npm run build
   cd ../../infra
   terraform workspace select staging
   terraform apply -target=aws_lambda_function.alexa_skill -auto-approve
   ```
3. Test with "Alexa, open ben am staging"
4. Check CloudWatch logs: `/aws/lambda/ben-am-staging-alexa-skill`

**When Ready for Production:**

1. Deploy to production Lambda:
   ```bash
   terraform workspace select default
   terraform apply -target=aws_lambda_function.alexa_skill -auto-approve
   ```
2. Test production skill: "Alexa, open ben am"
3. Verify your 7 AM routine uses the production skill

**Important Notes:**
- Both skills will be available on all your Alexa devices
- Routines are skill-specific, so staging/production routines are separate
- Staging skill connects to `ben-am-calendar-staging` DynamoDB table
- Production skill connects to `ben-am-calendar` DynamoDB table

## Getting the Alexa Skill on Your Personal Device

### Automatic Availability

**Skills you create are automatically available on your devices** - no installation or publishing required! Here's how it works:

1. **Create Skill in Developer Console**:
   - Once you create a skill at https://developer.amazon.com/alexa/console/ask
   - It's immediately available in "Development" stage

2. **Link Your Account**:
   - The Amazon account you use for the Developer Console must be the same account linked to your Alexa devices
   - Check: Alexa app → Settings → Account Settings → Should match your developer account

3. **Automatic Discovery**:
   - Your Alexa devices automatically discover skills in development
   - No need to enable or install anything
   - Just say the invocation name: "Alexa, open ben am"

### Verifying Skill Availability

**Method 1: Voice Test**
```
You: "Alexa, open ben am"
Alexa: "Good morning! Here's your wake up song..."
```

**Method 2: Alexa App**
1. Open Alexa app on phone
2. Go to **More** → **Skills & Games**
3. Tap **Your Skills** → **Dev**
4. You should see "Ben AM" listed
5. Tap it to see details (but no need to "enable" - already enabled)

**Method 3: Routines**
1. Create a routine (More → Routines → +)
2. Add Action → Skills
3. Tap "Your Skills"
4. Look for "Ben AM" in the list
5. If it appears, it's ready to use

### Troubleshooting "Skill Not Found"

**Issue: "I don't know that skill"**

1. **Check Account Match**:
   - Developer Console account email
   - Alexa app account email
   - Must be exactly the same

2. **Verify Skill Status**:
   - Go to Developer Console
   - Open your skill
   - Look for "Development" or "Live" status
   - If "Incomplete", you need to complete required sections

3. **Enable Testing**:
   - Go to Test tab in Developer Console
   - Make sure "Skill testing is enabled in: Development"
   - If disabled, enable it

4. **Check Invocation Name**:
   - Verify you're saying the exact invocation name
   - Check in Build tab → Invocation
   - "ben am" not "ben a m" or "ben-am"

5. **Wait for Propagation** (rare):
   - Sometimes takes 1-2 minutes for new skills to appear
   - Try logging out and back into Alexa app
   - Restart Alexa device (unplug for 10 seconds)

**Issue: "That skill can't be used with this device"**

- Check Build tab → Interfaces
- Enable "Audio Player" interface
- Save and rebuild model

### Using Multiple Alexa Devices

Your skill works on **all Alexa devices** linked to your Amazon account:

- Echo Dot in bedroom
- Echo Show in kitchen
- Fire TV Stick
- Alexa app on phone

**Device-Specific Routines:**

When creating the 7 AM alarm routine:
1. Select "From" at the bottom of routine setup
2. Choose specific device (e.g., "Bedroom Echo")
3. Alarm will only trigger on that device

**Testing on Specific Devices:**

```
"Alexa, open ben am"  (on any device with the skill)
```

### Sharing with Friends (Optional)

If you want friends to test your skill:

**Option 1: Beta Testing (Recommended)**
1. Developer Console → Distribution tab
2. Click "Beta Test"
3. Add testers' email addresses
4. They'll receive invitation to enable your skill
5. Skill appears as "Beta" in their Alexa app

**Option 2: Publish for Certification**
- Submit skill for Amazon certification
- If approved, anyone can enable it
- Not necessary for personal use

**For Ben AM, keep it private** - only you need it as an alarm!

## Alexa Skill Configuration

### Required Alexa Developer Console Setup

1. **Skill Information**:
   - Skill name: "Ben AM"
   - Invocation name: "ben am"
   - Category: Music & Audio

2. **Interaction Model** (Build tab):
   ```json
   {
     "interactionModel": {
       "languageModel": {
         "invocationName": "ben am",
         "intents": [
           {
             "name": "AMAZON.YesIntent",
             "samples": []
           },
           {
             "name": "AMAZON.NoIntent",
             "samples": []
           },
           {
             "name": "AMAZON.StopIntent",
             "samples": []
           },
           {
             "name": "AMAZON.CancelIntent",
             "samples": []
           },
           {
             "name": "AMAZON.PauseIntent",
             "samples": []
           },
           {
             "name": "AMAZON.ResumeIntent",
             "samples": []
           }
         ]
       },
       "audioplayer": {}
     }
   }
   ```

3. **Endpoint** (Build tab):
   - Service Endpoint Type: AWS Lambda ARN
   - Default Region: `arn:aws:lambda:us-east-1:668596205778:function:ben-am-alexa-skill`
   - (Use staging ARN for testing: `ben-am-staging-alexa-skill`)

4. **Permissions** (Build tab):
   - Enable: "AudioPlayer" interface

5. **Account Linking**: Not required

### Setting Up the 7 AM Alarm Routine

1. Open Alexa app on your phone
2. Go to **More** → **Routines**
3. Tap **+** to create new routine
4. **When this happens**: Schedule → Set time to 7:00 AM, repeat daily
5. **Add action**: 
   - Skills → Your Skills → Ben AM
   - Or: Custom → "Open Ben AM"
6. **From**: Select your bedroom Alexa device
7. Save

**Optional: Snooze Routine**
- **When this happens**: Voice → "Alexa, snooze"
- **Add action**: Wait → 9 minutes
- **Add action**: Custom → "Open Ben AM"

## Environment Variables

Set in Terraform (`infra/lambda.tf`):

```hcl
environment {
  variables = {
    TABLE_NAME         = "ben-am-calendar"          # DynamoDB table
    S3_BUCKET          = "ben-am-assets-..."        # S3 bucket for audio
    SES_EMAIL_SENDER   = "noreply@yourdomain.com"   # SES verified sender
    AWS_REGION         = "us-east-1"
  }
}
```

## Permissions Required

The Lambda IAM role needs:
- **DynamoDB**: `GetItem`, `Query`, `Scan` on `ben-am-calendar` table
- **S3**: `GetObject` on `ben-am-assets-*` bucket (for audio files)
- **S3**: `PutObject` on `ben-am-assets-*` bucket (for review recordings)
- **SES**: `SendRawEmail` (for sending review emails)

These are configured in `infra/iam.tf`.

## Troubleshooting

### "Sorry, there was an error"
- Check CloudWatch logs: `/aws/lambda/ben-am-alexa-skill`
- Common issues:
  - Song S3 key doesn't exist
  - Pre-signed URL expired (shouldn't happen with 24h expiry)
  - DynamoDB table empty

### Song doesn't play
- Verify S3 object exists and Lambda has `GetObject` permission
- Check pre-signed URL is valid (test in browser)
- Ensure MP3 is valid format (not corrupted)

### DJ message doesn't play
- For TTS: Check `djMessage` field in DynamoDB
- For recorded: Check `s3DJKey` exists in S3

### Review not emailed
- Verify SES email is verified (not in sandbox)
- Check SES sending limits
- Review CloudWatch logs for SES errors
- Check friend's spam folder
