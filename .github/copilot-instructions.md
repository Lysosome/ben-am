# Ben AM - AI Agent Instructions

## Project Overview
Ben AM is a serverless wake-up music system combining an Alexa Skill with a React web app. Friends pick songs via a calendar UI, the system downloads/processes them from YouTube, and Alexa plays them at 7 AM with custom DJ messages.

**Architecture**: Fully serverless AWS (Lambda + DynamoDB + S3 + SES) managed via Terraform, with frontend on CloudFront.

## Repository Structure
```
ben-am/
├── frontend/              # React + TypeScript + Vite + Material UI
│   ├── src/
│   │   ├── api/           # API client functions
│   │   ├── components/    # React components
│   │   ├── pages/         # Route pages (Calendar, SongSetup, Confirmation)
│   │   └── theme.ts       # MUI theme configuration
├── backend/
│   ├── alexa-skill/       # Alexa Skill Lambda handler (Node.js)
│   │   └── src/
│   │       ├── handlers/  # Intent handlers (Launch, AudioPlayer, Review)
│   │       └── index.ts   # Skill entry point
│   ├── api/               # REST API Lambdas (calendar, submissions, status)
│   │   └── src/
│   │       ├── handlers/  # Endpoint handlers (calendar.ts, submit.ts, etc.)
│   │       ├── types/     # TypeScript types (models.ts)
│   │       └── index.ts   # API exports
│   └── youtube-dl/        # YouTube download/conversion Lambda
│       └── src/
│           └── index.ts   # Download/convert logic with youtube-dl + ffmpeg
├── infra/                 # Terraform IaC (all AWS resources)
│   ├── main.tf            # Root module configuration
│   ├── dynamodb.tf        # Table definitions
│   ├── lambda.tf          # Lambda functions
│   ├── api-gateway.tf     # API Gateway routes
│   ├── s3.tf              # Buckets and lifecycle policies
│   └── variables.tf       # Environment-specific variables
└── package.json           # Root-level npm scripts (NOT a workspace)
```

## Key Architectural Patterns

### Data Flow
1. **Submission**: User → Web App → API Gateway → Lambda → DynamoDB + S3
2. **Processing**: API Lambda → Invoke youtube-dl Lambda → Download/convert → Store MP3 in S3
3. **Playback**: Alexa Routine (7 AM) → Skill Lambda → DynamoDB (fetch song) → S3 (stream MP3) → AudioPlayer

### Critical Integration Points
- **Date Locking**: 15-minute TTL locks in DynamoDB prevent double-booking (`/lock-date` API)
- **Pre-signed URLs**: S3 URLs generated on-demand for Alexa AudioPlayer (24-hour expiry)
- **Async Processing**: youtube-dl Lambda invoked asynchronously; frontend polls `/status/:id`
- **Review Flow**: Alexa captures audio → S3 → SES email to friend with attachment

### DynamoDB Schema (Primary Table)
```
PK: date (YYYY-MM-DD)
Attributes:
  - songTitle, youtubeURL, s3SongKey, thumbnailS3Key
  - djName, djType (recorded|tts), djMessage, s3DJKey
  - friendEmail, submittedBy (cookie ID)
  - createdAt (timestamp)
```

## Technology Decisions

### Frontend (React + TypeScript)
- **Vite** for fast builds (not CRA)
- **Material UI (MUI)** for theming - centralized in theme config
- **React Query/TanStack Query** for API state management and caching
- **js-cookie** for anonymous identity (no auth yet - future: Cognito)
- **YouTube iframe API** for preview embeds with timestamp seeking

### Backend (Node.js/TypeScript Lambdas)
- **ask-sdk-core** for Alexa Skill responses (AudioPlayer directives, SSML)
- **AWS SDK v3** for DynamoDB, S3, SES operations
- **youtube-dl** (or yt-dlp) binary bundled in Lambda layer for video download
- **ffmpeg** Lambda layer for audio conversion (YouTube → MP3, max 10 min)
- **Separate package.json per Lambda**: Each backend directory (alexa-skill, api, youtube-dl) has its own package.json and node_modules for independent dependency management and Lambda packaging

### Infrastructure (Terraform)
- **Workspaces** for dev/staging/prod environments
- **S3 lifecycle policies**: Delete temp files after 30 days, transition to IA
- **IAM least privilege**: Each Lambda has specific permissions (e.g., youtube-dl can write S3 but not read DynamoDB)
- **CloudFront** for frontend HTTPS (ACM cert)

## Developer Workflows

### Build Commands (from root)
```bash
# Installation - each directory has its own package.json
npm run install:all            # Install dependencies in all directories (frontend + 3 backend Lambdas)
# OR install individually:
cd frontend && npm install
cd backend/alexa-skill && npm install
cd backend/api && npm install
cd backend/youtube-dl && npm install

# Building
npm run build:frontend         # cd frontend && npm run build → frontend/dist
npm run build:backend          # Builds all 3 Lambda TypeScript projects → dist/
npm run dev                    # cd frontend && npm run dev (Vite dev server on localhost:5173)

# Cleaning
npm run clean                  # Remove all node_modules and dist directories across project
```

**Important**: This project does NOT use npm workspaces. Each directory (frontend, backend/alexa-skill, backend/api, backend/youtube-dl) manages its own dependencies independently. This ensures Lambda functions can be packaged with their dependencies by Terraform without hoisting issues.

### Deployment
```bash
# Deploy infrastructure (Terraform)
npm run deploy:infra           # = cd infra && terraform apply

# Manual frontend upload (after terraform creates bucket)
aws s3 sync frontend/dist s3://ben-am-frontend-bucket --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"

# Lambda deployment: Terraform handles zip upload automatically
```

### Local Development
- **Frontend**: `npm run dev` → Vite dev server on localhost:5173
  - Configure proxy in `vite.config.ts` to point to deployed API Gateway
  - Or use LocalStack for fully offline development
- **Backend**: Use `aws-sam local invoke` to test individual Lambda functions
  - `serverless-offline` can simulate API Gateway locally
- **Offline AWS**: DynamoDB Local + LocalStack S3 for testing without AWS costs

## Project-Specific Conventions

### Environment Variables
Backend Lambdas expect (set via Terraform):
```
AWS_REGION=us-east-1
TABLE_NAME=ben-am-calendar
S3_BUCKET=ben-am-assets
SES_EMAIL_SENDER=noreply@yourdomain.com
```

### Constraints to Enforce
- YouTube clips: **≤ 10 minutes** (enforced in API validation)
- DJ recordings: **1-60 seconds** (enforced in browser and API)
- Date locks: **15-minute TTL** (auto-cleanup via DynamoDB TTL field)
- One submission per date (enforced via DynamoDB conditional writes)

### File Naming Patterns
- S3 song keys: `songs/YYYY-MM-DD/{uuid}.mp3`
- Thumbnail keys: `thumbnails/YYYY-MM-DD/{uuid}.jpg`
- DJ recordings: `dj-messages/YYYY-MM-DD/{uuid}.mp3`
- Review recordings: `reviews/{date}-{submitter-id}.mp3`

### Alexa Skill Specifics
- **Invocation name**: "Ben AM" (configured in Alexa Developer Console)
- **Launch flow**: LaunchRequest → query DynamoDB → AudioPlayer.Play directive
- **Fallback**: If no song for today, randomly pick past entry
- **SSML for TTS**: Use `<speak><prosody rate="95%">` for DJ messages
- **Review recording**: After playback, prompt "Would you like to leave feedback?" → capture audio via `AudioRecorder` interface

## Common Tasks for AI Agents

### Adding a New API Endpoint
1. Create handler in `backend/api/src/handlers/{name}.ts`
2. Export in `backend/api/src/index.ts`
3. Add route in Terraform `infra/api-gateway.tf` (method + integration)
4. Update frontend API client in `frontend/src/api/client.ts`

### Modifying DynamoDB Schema
1. Update table definition in `infra/dynamodb.tf`
2. Update TypeScript types in `backend/api/src/types/models.ts`
3. Run `terraform apply` to update schema (non-breaking only; breaking changes require migration)

### Updating Alexa Skill Responses
1. Modify handlers in `backend/alexa-skill/src/handlers/`
2. Build: `cd backend/alexa-skill && npm run build`
3. Terraform auto-deploys on next apply (or use `aws lambda update-function-code`)

### Theming the Frontend
Edit `frontend/src/theme.ts`:
```typescript
export const theme = createTheme({
  palette: {
    primary: { main: '#1db954' },    // Spotify green
    secondary: { main: '#191414' },  // Dark background
  },
  typography: { fontFamily: 'Inter, sans-serif' },
});
```

## Testing Strategy
- **Frontend**: Component tests with Vitest + React Testing Library
- **Backend**: Unit tests with Jest for Lambda handlers
- **Integration**: Use `aws-sam local invoke` or LocalStack for end-to-end flows
- **Alexa**: Test via Alexa Developer Console simulator

## Key Files to Reference
- **tech-spec.md**: Complete architectural design document
- **README.md**: Setup instructions and tech stack overview
- **package.json**: Workspace structure and npm scripts
- **infra/**: All Terraform modules for AWS resources
