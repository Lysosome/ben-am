# Ben AM — Technical Design & Implementation Document

## Overview
The "Ben AM" is a project that combines a custom **Alexa Skill** with a **React-based web app** and **AWS serverless backend** to let friends pick your daily wake-up music and record or auto-generate personalized DJ-style messages.

---

## 1. Alexa Skill

### 1.1 Core Functionality
The Alexa skill will:
1. Run via an Alexa Routine scheduled at (e.g.) 7 AM daily.
2. Fetch the song assigned for today’s date from DynamoDB through a backend API.
3. Stream the processed MP3 file from S3 via a pre-signed URL.
4. Play the song audio.
5. After playback, play the DJ message (human-recorded or TTS-generated).
6. Optionally prompt the user to leave a review for the submitting friend and record it to be emailed.

### 1.2 Skill Architecture

#### Interaction Flow
1. **Alexa Routine trigger → LaunchRequest** to custom skill endpoint.
2. Lambda handler:
   - Query DynamoDB for today’s date entry.
   - If no song found, randomly pick one from past entries.
   - Get S3 pre-signed URL for MP3 and thumbnail.
3. **Alexa AudioPlayer** directive plays MP3.
4. On `AudioPlayer.PlaybackFinished` → trigger next directive to play the DJ message.
5. If DJ message type is:
   - **Recorded** → fetch recorded MP3 from S3.
   - **Text-to-Speech (TTS)** → construct SSML message and return as plain speech response.
6. Prompt for review (intent handler `ReviewIntent`):
   - If user says “Yes” → enter recording flow.
   - Recorded audio is captured, saved to S3, and emailed using SES to the friend’s email.

#### Example AWS Services Involved
- **Lambda (Alexa Skill handler)** — Node.js function deployed through AWS Lambda.
- **API Gateway / Alexa skill endpoint** — Hosted on AWS API Gateway as an HTTPS endpoint.
- **S3** — Stores all audio files (songs, DJ messages, user reviews).
- **DynamoDB** — Stores song metadata, date associations, and friend contact data.
- **SES** — Sends review recordings to friends.
- **CloudWatch** — Logs Alexa interactions and errors.

### 1.3 Data Model (Simplified)

| Field | Type | Description |
|-------|------|-------------|
| `date` | String (YYYY-MM-DD) | Calendar date |
| `songTitle` | String | Title of the song |
| `youtubeURL` | String | Original YouTube source |
| `s3SongKey` | String | Path in S3 to MP3 file |
| `s3DJKey` | String | Path to DJ message audio (if recorded) |
| `djName` | String | Friend’s display name |
| `djType` | String (`'recorded' | 'tts'`) | How DJ message is produced |
| `djMessage` | String | Optional text used for TTS |
| `friendEmail` | String | For sending review recordings |
| `submittedBy` | String | Friend browser cookie ID |
| `thumbnailS3Key` | String | Path to thumbnail image |
| `createdAt` | Timestamp | Submission time |

---

## 2. AWS Infrastructure

### 2.1 Overview

The system will be fully serverless and IaC-managed via **Terraform**.  
All compute work, storage, and API endpoints are on the free or low-cost AWS tiers.

**Key goals:**  
- Minimal operating cost (serverless / pay-per-use).  
- Simple developer setup using Terraform & monorepo.  
- Infrastructure-as-code for reproducible deployments.  

### 2.2 Architecture Diagram (Conceptual)

```
[ Web Browser ]
  ↓
[ CloudFront + S3 Static Hosting ]
  ↓
[ API Gateway ]
  ↓               → [ Lambda: youtube-dl processor ]
  ↓               → [ Lambda: Alexa Skill handler ]
  ↓               → [ Lambda: DynamoDB CRUD + review sender ]
[ DynamoDB ] ←→ [ S3 (songs, dj clips, thumbnails, reviews) ]
                      ↓
                   [ SES ]
```

### 2.3 Components

| Component | Technology | Description |
|------------|-------------|-------------|
| Static hosting | S3 + CloudFront | Hosts React frontend; HTTPS provided by ACM. |
| Backend API | API Gateway (REST) + Lambda (Node.js/TypeScript) | Handles all frontend API requests and Alexa Skill webhook. |
| Data storage | DynamoDB | Stores song metadata, friend data, and calendar lock info. |
| File storage | S3 | Stores MP3s, thumbnails, reviews. Lifecycle rules delete old intermediates after 30 days. |
| Email | SES | Sends review emails with optional audio attachments. |
| Task worker | AWS Lambda (youtube-dl) | Downloads and converts YouTube clips to MP3/thumbnail. |
| Security & IAM | AWS IAM | Fine-grained permissions per Lambda; least privilege model. |
| IaC | Terraform | Deploys all resources; monorepo integration. |

### 2.4 Deployment Strategy
- Use **Terraform workspaces** for dev/staging/prod environments.
- Continuous deployment with GitHub Actions:
  - Frontend → build, upload to S3, invalidate CloudFront cache.
  - Backend → compile TypeScript → zip → deploy Lambda code via Terraform.

### 2.5 Cost Controls and Monitoring
- DynamoDB with on-demand capacity mode (low traffic).
- S3 lifecycle rules to transition old data to Infrequent Access / delete logs.
- CloudWatch alarms for unusual Lambda invocation spikes.

---

## 3. Web App

### 3.1 Overview
A **React + TypeScript** single-page web app for friends to select a date on a global calendar, upload or link a YouTube song, configure DJ messages, and optionally include an email for receiving a review recording.

### 3.2 Frontend Tech Stack
- **React.js** + **TypeScript**
- **Vite** (fast build setup)
- **Material UI (MUI)** for components, easily themable (color/font templates).
- **React Query / TanStack Query** for API caching and async state.
- **React Router** for routing (Calendar, Song Setup, Submission Confirmation).
- **YouTube iframe API** for preview embeds & seeking.
- **Simple cookie library** (e.g. js-cookie) for persistent identity storage.

### 3.3 Frontend Flow

1. **Calendar View**
   - Fetches calendar events via backend API (`GET /calendar`).
   - Shows thumbnails for existing songs.
   - Available dates are clickable.
   - When a user clicks on a date:
     - Calls `POST /lock-date?date=YYYY-MM-DD`
     - Backend writes lock record with TTL (15 minutes).
   - If lock confirmed, navigates user to *Song Setup* page.

2. **Song Setup**
   - User pastes YouTube link.
   - Backend (or frontend using YouTube API) fetches metadata (title, duration, thumbnail).
   - Displays embedded preview.
   - Allows optional trimming of timestamps, ensuring ≤ 10 minutes.

3. **DJ Message Setup**
   - Option 1: Record audio in-browser via Web Audio API (max 60s), upload on submit.
   - Option 2: Text form → Song Title, DJ Name (pre-filled from cookie), optional Message (for Alexa TTS).
   - “Request Review” checkbox reveals email field (pre-filled if cookie present).

4. **Submission**
   - On submit, data POSTs to backend (`/submit-song`).
   - Response triggers an asynchronous **Lambda youtube-dl job**.
   - UI shows calendar loading spinner while job runs (polling `/status`).

5. **Upon Success**
   - Calendar updates with thumbnail hover-info (song title, DJ name).
   - Snackbars show success or error status accordingly.

### 3.4 Backend Lambda APIs

| Endpoint | Method | Description |
|-----------|--------|-------------|
| `/calendar` | GET | Fetch all existing songs and locks |
| `/lock-date` | POST | Lock date for submission (15-min TTL) |
| `/submit-song` | POST | Submit song metadata; trigger download Lambda |
| `/status/:id` | GET | Poll job status for download/conversion |
| `/reviews` | POST | Upload review recording and trigger SES email |

### 3.5 Data Validation and Constraints
- YouTube duration <= 10 minutes.
- DJ recording 1–60 sec.
- One submission per date.
- Lock automatically deleted after TTL.

### 3.6 Styling & Theming
Use MUI Theme Provider with centralized theme configuration:
```typescript
export const theme = createTheme({
  palette: { primary: { main: '#1db954' }, secondary: { main: '#191414' } },
  typography: { fontFamily: 'Inter, sans-serif' },
});
```
Developers can easily edit colors/fonts globally.

---

## 4. Monorepo and Developer Setup

### 4.1 Structure
```
/ben-am
 ├── /frontend/          # React app
 ├── /backend/           # Node.js Lambdas
 │    ├── /alexa-skill/
 │    ├── /api/
 │    └── /youtube-dl/
 ├── /infrastructure/    # Terraform configuration
 ├── README.md
 └── package.json        # Workspaces + scripts
```

### 4.2 Setup Steps
1. Clone repo.
2. Install dependencies: `npm install`
3. Build frontend: `npm run build --workspace frontend`
4. Deploy infrastructure: `terraform init && terraform apply` from `/infrastructure`
5. Upload frontend build to S3 bucket indicated by Terraform output.
6. Register Alexa skill with Lambda endpoint ARN output.

### 4.3 Local Development
- Run `vite dev` for local frontend.
- Use `serverless-offline` or `aws-sam` for local Lambda testing.
- DynamoDB Local & S3 LocalStack for testing without AWS cost.

---

## 5. Future Considerations
- Replace cookie-based identity with Cognito-based user auth.
- Add a moderation system or “friend groups.”
- Optional Spotify/Youtube integration for playback licensing.
- Support for sharing clips or social leaderboard.

---

## 6. License and Distribution
- Entire repository under **MIT License**, allowing others to copy and adapt freely.
- README includes sections for:
  - Environment setup
  - AWS credentials
  - Terraform variable definition
  - Alexa skill configuration steps
  - Contribution guidelines

---

✅ **Deliverables Summary**
- React + TypeScript SPA (web app)
- Alexa Skill (Node.js Lambda)
- Infrastructure-as-Code on Terraform
- Serverless AWS backend (API Gateway, Lambda, DynamoDB, S3, SES)
- Fully self-contained monorepo  
