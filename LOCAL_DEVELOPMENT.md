# Local Development Guide

This guide will help you run the Ben AM application locally for development and testing.

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- AWS CLI configured with credentials
- Access to your deployed AWS resources (DynamoDB, S3, etc.)

## Architecture

The application consists of:
- **Frontend**: React app (Vite dev server on port 5173)
- **Backend API**: Lambda functions that you'll invoke locally
- **AWS Services**: Uses your deployed DynamoDB, S3, and SES

## Option 1: Frontend with Deployed Backend (Easiest)

This is the simplest approach - run the frontend locally and connect to your deployed API Gateway.

### Steps:

1. **Navigate to frontend directory**:
   ```bash
   cd /home/lysosome/ben-am/frontend
   ```

2. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

3. **Create local environment file**:
   ```bash
   cat > .env.local << EOF
   VITE_API_URL=https://u47r2372d0.execute-api.us-east-1.amazonaws.com/default
   EOF
   ```

4. **Start the dev server**:
   ```bash
   npm run dev
   ```

5. **Access the app**:
   Open your browser to: http://localhost:5173

The frontend will proxy API requests to your deployed API Gateway.

---

## Option 2: Full Local Development with SAM CLI

**Note: This option requires Docker to be installed and running.**

To run both frontend and backend locally, you'll need AWS SAM CLI and Docker.

### Install Docker (Required):

```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
# Then verify Docker is running:
docker --version
```

### Install AWS SAM CLI:

```bash
# Download and install SAM CLI
curl -L https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip -o sam.zip
unzip sam.zip -d sam-installation
sudo ./sam-installation/install
```

### Setup Steps:

1. **Create SAM template** for local testing:
   ```bash
   cd /home/lysosome/ben-am
   cat > template.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Ben AM Local Development

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    Environment:
      Variables:
        TABLE_NAME: ben-am-calendar
        S3_BUCKET: ben-am-assets-668596205778
        SES_EMAIL_SENDER: chimera.recommender@gmail.com
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      CodeUri: backend/api/
      Events:
        GetCalendar:
          Type: Api
          Properties:
            Path: /calendar
            Method: GET
        PostLockDate:
          Type: Api
          Properties:
            Path: /lock-date
            Method: POST
        PostSubmitSong:
          Type: Api
          Properties:
            Path: /submit-song
            Method: POST
        GetStatus:
          Type: Api
          Properties:
            Path: /status/{id}
            Method: GET
        PostReviews:
          Type: Api
          Properties:
            Path: /reviews
            Method: POST

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
EOF
   ```

2. **Build the Lambda functions**:
   ```bash
   # Build all backend Lambda functions
   npm run build --workspace backend/api
   npm run build --workspace backend/alexa-skill
   npm run build --workspace backend/youtube-dl
   ```

3. **Start local API**:
   ```bash
   # This starts a local API Gateway on http://localhost:3000
   sam local start-api --port 3000
   ```

4. **In a new terminal, start the frontend**:
   ```bash
   cd /home/lysosome/ben-am/frontend
   
   # Create local env pointing to local API
   cat > .env.local << EOF
   VITE_API_URL=http://localhost:3000
   EOF
   
   # Start frontend dev server
   npm run dev
   ```

5. **Access the app**:
   - Frontend: http://localhost:5173
   - Local API: http://localhost:3000

---

## Option 3: Mock Backend with MSW (for Frontend-Only Dev)

If you want to develop the frontend without any backend, use Mock Service Worker.

### Steps:

1. **Install MSW**:
   ```bash
   cd /home/lysosome/ben-am/frontend
   npm install -D msw@latest
   ```

2. **Create mock handlers**:
   ```bash
   mkdir -p src/mocks
   cat > src/mocks/handlers.ts << 'EOF'
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/calendar', () => {
    return HttpResponse.json({
      calendar: [
        {
          date: '2025-11-13',
          songTitle: 'Wake Me Up',
          thumbnailURL: 'https://via.placeholder.com/300',
          djName: 'Alice',
          isAvailable: true,
          isLocked: false,
        },
        {
          date: '2025-11-14',
          songTitle: '',
          thumbnailURL: '',
          djName: '',
          isAvailable: true,
          isLocked: false,
        },
        // Add more mock dates as needed
      ],
    });
  }),

  http.post('/api/lock-date', () => {
    return HttpResponse.json({
      success: true,
      locked: true,
      expiresAt: Date.now() + 900000, // 15 minutes
    });
  }),

  http.post('/api/submit-song', () => {
    return HttpResponse.json({
      success: true,
      jobId: 'test-job-123',
      date: '2025-11-13',
    });
  }),

  http.get('/api/status/:jobId', () => {
    return HttpResponse.json({
      success: true,
      status: 'completed',
      progress: 100,
    });
  }),
];
EOF
   ```

3. **Create MSW setup**:
   ```bash
   cat > src/mocks/browser.ts << 'EOF'
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
EOF
   ```

4. **Initialize MSW in main.tsx**:
   ```bash
   cat > src/main.tsx << 'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Start mock service worker in development
if (import.meta.env.DEV) {
  import('./mocks/browser').then(({ worker }) => {
    worker.start({
      onUnhandledRequest: 'bypass',
    });
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
EOF
   ```

5. **Generate MSW service worker**:
   ```bash
   npx msw init public/ --save
   ```

6. **Start dev server**:
   ```bash
   npm run dev
   ```

Now the frontend will use mock data - perfect for UI development!

---

## Testing the Backend Locally

### Test Individual Lambda Functions

You can test individual Lambda functions without running the full API:

```bash
# Test API Lambda with a sample event
cd /home/lysosome/ben-am
sam local invoke ApiFunction -e test-events/calendar.json

# Create a test event file first:
mkdir -p test-events
cat > test-events/calendar.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/calendar",
  "headers": {},
  "queryStringParameters": null,
  "body": null
}
EOF
```

### Test with curl:

```bash
# Test deployed API
curl https://u47r2372d0.execute-api.us-east-1.amazonaws.com/default/calendar

# Test local API (if using SAM)
curl http://localhost:3000/calendar
```

---

## Environment Variables Reference

### Frontend (.env.local)
```bash
VITE_API_URL=https://u47r2372d0.execute-api.us-east-1.amazonaws.com/default
# OR for local backend:
# VITE_API_URL=http://localhost:3000
```

### Backend (set by Terraform, but for local testing):
```bash
AWS_REGION=us-east-1
TABLE_NAME=ben-am-calendar
S3_BUCKET=ben-am-assets-668596205778
SES_EMAIL_SENDER=chimera.recommender@gmail.com
MAX_SONG_DURATION_SECONDS=600
```

---

## Common Issues & Solutions

### Issue: 502 Bad Gateway from API
**Solution**: Make sure your backend Lambdas are built:
```bash
npm run build --workspace backend/api
cd /home/lysosome/ben-am/infra
terraform apply -target=aws_lambda_function.api
```

### Issue: CORS errors in browser
**Solution**: The API should have CORS enabled. Check browser console for details.

### Issue: DynamoDB access denied
**Solution**: Make sure your AWS CLI is configured with proper credentials:
```bash
aws sts get-caller-identity  # Should show your account
```

### Issue: Frontend can't connect to local API
**Solution**: Check that:
1. SAM local API is running on port 3000
2. `.env.local` has correct `VITE_API_URL`
3. Restart Vite dev server after changing `.env.local`

---

## Recommended Development Flow

1. **Start with Option 1** (frontend + deployed backend) - fastest setup
2. **Use Option 3** (MSW mocks) if you want to work on UI without hitting real AWS
3. **Use Option 2** (SAM local) only if you need to debug backend Lambda code

---

## Hot Reload & Development Tips

### Frontend Hot Reload
Vite automatically reloads when you save files in `frontend/src/`

### Backend Changes
If using SAM local, you need to rebuild after backend changes:
```bash
# In one terminal:
npm run build --workspace backend/api && sam local start-api

# Or use nodemon for auto-rebuild:
npm install -g nodemon
nodemon --watch backend/api/src --ext ts --exec "npm run build --workspace backend/api"
```

### Debugging Lambda Functions Locally
```bash
# Start SAM with debug port
sam local start-api --debug-port 5858

# Then attach your debugger (VS Code, Chrome DevTools, etc.)
```

---

## Next Steps

Once you have everything running locally:
1. Test the calendar page
2. Try locking a date
3. Submit a test song (won't actually download from YouTube in local mode)
4. Check the confirmation page

Enjoy developing! 🚀
