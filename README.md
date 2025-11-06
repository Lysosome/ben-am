# 🎶 Ben AM

An Alexa skill and companion web app that lets your friends choose your wake-up music and record personalized DJ-style announcements!  

Built with React, TypeScript, Node.js, and AWS serverless infrastructure.

---

## 🧠 Overview

**Ben AM** is an Alexa skill connected to a serverless AWS backend and web app, where friends can:

- Pick a date and select a YouTube song.
- Customize a “DJ message” (either a TTS message or a recorded clip).
- Optionally request feedback that will be recorded through Alexa.
- Trigger playback automatically each morning via an Alexa Routine.

When the skill runs each morning, Alexa fetches the day’s song and DJ message from AWS, plays the song, and follows it up with the DJ announcement.

---

## 🗂️ Repository Structure

```
ben-am/
├── frontend/              # React + TypeScript web app
├── backend/
│   ├── alexa-skill/       # Node.js Lambda for Alexa Skill
│   ├── api/               # API Gateway Lambdas (calendar, submissions, etc.)
│   └── youtube-dl/        # Video download & conversion Lambda
├── infrastructure/        # Terraform IaC definitions (S3, DynamoDB, Lambdas, etc.)
├── package.json           # Monorepo root dependencies and npm scripts
└── README.md
```

---

## 🚀 Technology Stack

| Area | Technology |
|------|-------------|
| **Frontend** | React.js + TypeScript + Vite + Material UI |
| **Backend** | Node.js (TypeScript), Express-style APIs on AWS Lambda |
| **Infra** | AWS Lambda, DynamoDB, S3, SES, CloudFront, API Gateway |
| **Infrastructure-as-Code** | Terraform |
| **Automation** | GitHub Actions (CD), npm workspaces |
| **Alexa Skill SDK** | `ask-sdk-core` for Node.js |

---

## 🏗️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ben-am.git
cd ben-am
```

### 2. Install Dependencies
```bash
npm install
```

This uses npm workspaces to install dependencies across all packages.

---

### 3. Environment Setup

Create a `.env` file in `/backend` and fill in the following environment variables:

```bash
AWS_REGION=us-east-1
TABLE_NAME=ben-am-calendar
S3_BUCKET=ben-am-assets
SES_EMAIL_SENDER=you@example.com
```

---

### 4. Build the Frontend
```bash
cd frontend
npm run build
```

This creates a production build of the web app in `frontend/dist`.

---

### 5. Deploy AWS Infrastructure
```bash
cd infrastructure
terraform init
terraform apply
```

This provisions:
- S3 static hosting for your frontend  
- API Gateway endpoints  
- Lambda functions (Alexa, API, youtube-dl)  
- DynamoDB table for song metadata  
- SES configuration for email  

---

### 6. Connect the Alexa Skill

1. Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
2. Create a new **custom skill** and choose “Provision your own Lambda.”
3. Paste in the Lambda ARN output by Terraform (`alexa_skill_lambda_arn`).
4. Set the **Invocation Name** to `Ben AM`.
5. Deploy and test using the Alexa console or your device.

---

## 🧪 Testing Locally

### Web App
```bash
cd frontend
npm run dev
```
Starts a local dev server (Vite) on [http://localhost:5173](http://localhost:5173).

### Lambda Backend (Optional Local Simulation)
Use [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/) or [LocalStack](https://localstack.cloud/) to emulate AWS services.

---

## 📚 Development Workflow

| Task | Command |
|------|----------|
| Build all TypeScript Lambdas | `npm run build:backend` |
| Lint & type-check | `npm run lint` |
| Run frontend dev server | `npm run dev --workspace frontend` |
| Deploy AWS (Terraform) | `npm run deploy:infra` |

---

## 🧱 Folder Details

### `/frontend`
React app where friends choose songs and record DJ messages.

### `/backend/alexa-skill`
Lambda function for Alexa Skill integration. Handles:
- Fetching daily song metadata
- Playing MP3 from S3
- Triggering DJ message or text-to-speech
- Capturing optional voice review and emailing to friend

### `/backend/api`
Serverless REST endpoints for the web app:
- Calendar management
- Song submissions
- Review uploads

### `/backend/youtube-dl`
Lambda for downloading YouTube music clips and converting to MP3.

### `/infrastructure`
Terraform templates for all AWS resources:
- DynamoDB (metadata)
- S3 (storage)
- Lambda (compute)
- API Gateway (endpoints)
- SES (email)
- CloudFront (CDN)

---

## 🧩 Tech Highlights

- **Serverless-first architecture** → cost efficient and scalable  
- **Single global calendar** → DynamoDB global table  
- **Automatic S3 lifecycle policies** to lower storage cost  
- **Theme-based UI** → easy to restyle colors, fonts, branding
- **MIT license** for open collaboration

---

## 🪪 License

MIT License © 2025 Ben Ma

---

## ❤️ Contributing

Pull requests welcome! If you find an improvement, fork the repo, make your changes, and open a PR.  

For major changes, please open an issue to discuss first.

---

## 📧 Contact

Created by Ben Ma - ben@benma.dev
Feedback, issues, or collaboration ideas are always welcome!