# Ben AM Frontend

React web application for the Ben AM wake-up music system.

## Technology Stack

- **React 18.3** - UI library
- **TypeScript** - Type safety
- **Vite 5.3** - Build tool and dev server
- **Material UI 5.15** - Component library
- **TanStack Query 5.45** - Server state management
- **React Router 6.23** - Client-side routing
- **Axios** - HTTP client
- **js-cookie** - Cookie management

## Project Structure

```
src/
├── api/
│   └── client.ts          # API client and endpoint functions
├── components/
│   ├── DJMessageSetup.tsx # DJ message recording/TTS component
│   └── YouTubePreview.tsx # YouTube video preview with time range selector
├── pages/
│   ├── CalendarPage.tsx   # Main calendar view
│   ├── SongSetupPage.tsx  # Song submission flow
│   ├── ConfirmationPage.tsx # Processing status and confirmation
│   └── AdminPage.tsx      # Admin controls for calendar management
├── utils/
│   └── user.ts            # User cookie management
├── App.tsx                # Root component with routing
├── main.tsx               # Application entry point
├── theme.ts               # Material UI theme configuration
└── index.css              # Global styles
```

## Development

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment configuration (optional):
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### API Configuration

During development, the Vite dev server proxies `/api` requests to the backend API Gateway. Configure the backend URL using environment files.

### Environment Files

Vite loads environment files based on the `--mode` flag:

**File Priority (highest to lowest):**
1. `.env.[mode].local` (e.g., `.env.staging.local`)
2. `.env.[mode]` (e.g., `.env.staging`)
3. `.env.local` (only when no mode specified)
4. `.env`

**Available environment files:**
- `.env.local` - Local development (default for `npm run dev`)
- `.env.staging` - Staging environment
- `.env.production` - Production environment

**Configuration:**
```bash
# .env.local (local development)
VITE_API_URL=http://localhost:3000

# .env.staging (staging deployment)
VITE_API_URL=https://staging-api.yourdomain.com

# .env.production (production deployment)
VITE_API_URL=https://api.yourdomain.com
```

**Important:** When building with `--mode staging`, Vite will:
- ✅ Load `.env.staging`
- ❌ Ignore `.env.local` (local overrides don't apply)
- ❌ Ignore `.env.production`

## Building for Production

### Development Build (uses .env.local)
```bash
npm run dev
# or for staging mode in dev:
npm run dev:staging
```

### Production Build

**Staging:**
```bash
npm run build:staging  # Uses .env.staging
```

**Production:**
```bash
npm run build:production  # Uses .env.production
# or just:
npm run build
```

The production build will be output to the `dist/` directory.

## Deployment

The frontend is deployed to an S3 bucket configured for static website hosting, with CloudFront as the CDN.

### Automated Deployment

Use the root-level `deploy.sh` script for environment-specific deployments:

```bash
# Deploy to staging (uses .env.staging)
./deploy.sh staging

# Deploy to production (uses .env.production)
./deploy.sh production
```

This script will:
1. Build the frontend with the correct environment mode
2. Select the appropriate Terraform workspace
3. Deploy infrastructure with Terraform
4. Sync built files to S3
5. Invalidate CloudFront cache

### Manual Deploy to S3

If you need to deploy manually:

```bash
# Build for specific environment
npm run build:staging  # or build:production

# Sync to S3 (replace with your bucket name)
aws s3 sync dist/ s3://ben-am-frontend-bucket --delete

# Invalidate CloudFront cache (replace with your distribution ID)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Features

### Calendar Page
- Displays available dates for song submissions
- Shows thumbnails for existing songs
- Indicates locked dates (currently being edited)
- Click available dates to start submission flow

### Song Setup Page
- Lock date for 15 minutes to prevent conflicts
- YouTube URL input with video metadata extraction
- Video preview with custom time range selection (max 10 minutes)
- DJ message options:
  - Record audio message (1-60 seconds)
  - Text-to-Speech with custom message
- Optional friend email for review requests

### Confirmation Page
- Real-time processing status updates
- Progress indicator for YouTube download/conversion
- Success/failure feedback
- Navigation back to calendar

### Admin Page (`/admin`)
- **Block dates**: Mark future dates as unavailable for submissions
- **Unblock dates**: Remove blocks from previously blocked dates
- **Move songs**: Transfer a song from one date to another available date
- **Delete songs**: Permanently remove songs and associated S3 files
- View all occupied dates and their status
- Future-date-only editing (past dates cannot be modified)

## API Integration

The frontend communicates with the backend API through the following endpoints:

### Public Endpoints
- `GET /calendar` - Fetch all calendar entries
- `POST /lock-date` - Lock a date for 15 minutes
- `POST /submit-song` - Submit song with YouTube URL and DJ message
- `GET /status/:jobId` - Poll processing status
- `POST /reviews` - Submit voice review

### Admin Endpoints
- `POST /admin/block-date` - Block a date from submissions
- `DELETE /admin/unblock-date` - Unblock a previously blocked date
- `PUT /admin/move-song` - Move a song to a different date
- `DELETE /admin/delete-song` - Delete a song and its S3 files

See `src/api/client.ts` for TypeScript types and API functions.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires support for:
- ES2020 features
- Web Audio API (for DJ recording)
- YouTube IFrame API

## Troubleshooting

### Dev server proxy errors

If you see CORS errors or proxy failures, ensure your backend API Gateway is running and accessible. Update the proxy configuration in `vite.config.ts` if needed.

### YouTube videos not loading

The YouTube IFrame API requires an internet connection. If videos don't load:
1. Check browser console for errors
2. Verify the YouTube video ID is valid
3. Ensure the video is not region-restricted

### Audio recording not working

Audio recording requires microphone permissions:
1. Check browser permissions for microphone access
2. Ensure HTTPS is enabled (required for getUserMedia API)
3. Test in a supported browser (Chrome, Firefox, Edge)

## Scripts

- `npm run dev` - Start Vite development server (uses `.env.local`)
- `npm run dev:staging` - Start dev server with staging environment (uses `.env.staging`)
- `npm run build` - Build for production (uses `.env.production`)
- `npm run build:staging` - Build for staging environment (uses `.env.staging`)
- `npm run build:production` - Build for production environment (uses `.env.production`)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on TypeScript/TSX files
