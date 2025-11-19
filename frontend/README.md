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
│   └── ConfirmationPage.tsx # Processing status and confirmation
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

During development, the Vite dev server proxies `/api` requests to the backend API Gateway. No additional configuration is needed.

For production builds, set the `VITE_API_URL` environment variable to your API Gateway endpoint:

```bash
VITE_API_URL=https://your-api-gateway.execute-api.us-east-1.amazonaws.com/prod
```

## Building for Production

```bash
npm run build
```

The production build will be output to the `dist/` directory.

## Deployment

The frontend is deployed to an S3 bucket configured for static website hosting, with CloudFront as the CDN.

### Deploy to S3

```bash
# Build the frontend
npm run build

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

## API Integration

The frontend communicates with the backend API through the following endpoints:

- `GET /calendar` - Fetch all calendar entries
- `POST /lock-date` - Lock a date for 15 minutes
- `POST /submit-song` - Submit song with YouTube URL and DJ message
- `GET /status/:jobId` - Poll processing status
- `POST /reviews` - Submit voice review

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

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production (TypeScript + Vite)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on TypeScript/TSX files
