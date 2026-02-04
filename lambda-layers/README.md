# Lambda Layers for YouTube Download

This directory contains scripts to build Lambda layers for yt-dlp, ffmpeg, YouTube cookies, and ascii-image-converter.

## Layers Needed

1. **yt-dlp**: YouTube video downloader
2. **ffmpeg**: Audio/video processing
3. **youtube-cookies**: YouTube authentication cookies (sensitive)
4. **ascii-image-converter**: Convert thumbnails to ASCII art

## Building the Layers

### 1. Build yt-dlp Layer

⚠️ **Important**: yt-dlp must be updated frequently (every 1-2 weeks) as YouTube makes breaking API changes.

**Quick update workflow:**
```bash
# From project root - builds and deploys in one command
npm run update:yt-dlp-full

# Then update Terraform with the new layer ARN and apply:
cd infra
# Edit lambda.tf to update the layer version number in the ARN
terraform apply
```

**Manual workflow:**
```bash
# Just build the layer
cd lambda-layers
./build-yt-dlp-layer.sh

# Or use npm script from root
npm run update:yt-dlp

# Deploy to AWS (after building)
npm run deploy:yt-dlp-layer
```

The build script will:
- Check for the latest yt-dlp version from GitHub
- Compare with your currently deployed layer
- Prompt you to continue if the layer was recently updated
- Include version and date in the layer description for tracking

### 2. Build ffmpeg Layer

```bash
cd lambda-layers
./build-ffmpeg-layer.sh
```

### 3. Build Cookies Layer (Required for YouTube Authentication on AWS)


It seems from [this thread](https://github.com/yt-dlp/yt-dlp/issues/12475) that Youtube actively blocks datacenter IP's (e.g., AWS Lambda server IP's). A workaround is to provide your Youtube account cookies. For more information, see [here](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies).

First, export your YouTube cookies from your browser:

1. Install a browser extension to export cookies (make sure you have enabled it in extension settings to be available in incognito mode):
   - Chrome/Edge: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. Open an incognito tab, sign in to YouTube in your browser, then go to https://www.youtube.com/robots.txt

3. Use the extension to export cookies in Netscape format

4. Save as `cookies.txt` in this directory (`lambda-layers/cookies.txt`)

5. Build the cookies layer:

```bash
cd lambda-layers
./build-cookies-layer.sh
```

### 4. Build ASCII Image Converter Layer

This layer provides high-quality ASCII art conversion for thumbnails.

```bash
cd lambda-layers
./build-ascii-converter-layer.sh
```

### 5. Upload to AWS

**Recommended:** Use the npm scripts for easier updates:
```bash
# From project root
npm run deploy:yt-dlp-layer    # Deploys yt-dlp layer with version tracking
npm run update:yt-dlp-full     # Build + deploy in one command
```

**Manual upload:**
```bash
# Upload yt-dlp layer
aws lambda publish-layer-version \
  --layer-name yt-dlp-binary \
  --description "yt-dlp $(date +%Y-%m-%d)" \
  --zip-file fileb://yt-dlp-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1

# Upload ffmpeg layer
aws lambda publish-layer-version \
  --layer-name ffmpeg-binary \
  --description "ffmpeg binary for Lambda" \
  --zip-file fileb://ffmpeg-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1

# Upload cookies layer (SENSITIVE - keep private!)
aws lambda publish-layer-version \
  --layer-name youtube-cookies \
  --description "YouTube authentication cookies" \
  --zip-file fileb://cookies-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1

# Upload ascii-image-converter layer
aws lambda publish-layer-version \
  --layer-name ascii-image-converter \
  --description "ascii-image-converter Go binary" \
  --zip-file fileb://ascii-converter-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1
```

After uploading, **update the layer ARNs in `infra/lambda.tf`** with the new version number, then run:
```bash
cd infra
terraform apply
```

## Maintenance Schedule

### yt-dlp Updates
**Frequency**: Every 1-2 weeks (or when YouTube breaks)

YouTube frequently changes their API, causing yt-dlp to break. Signs you need to update:
- Songs fail to download in the Lambda logs
- "Sign in to confirm you're not a bot" errors
- HTTP 403 or 429 errors from YouTube

**Quick fix:**
```bash
npm run update:yt-dlp-full
# Then update infra/lambda.tf and terraform apply
```

### Cookie Updates
**Frequency**: Every 2-3 months (or when authentication fails)

See the "Cookie Expiration" section below for details.

## Layer Structure

Lambda layers should have binaries in `/opt/bin/` which is automatically added to PATH:

```
yt-dlp-layer/
└── bin/
    └── yt-dlp

ffmpeg-layer/
└── bin/
    ├── ffmpeg
    └── ffprobe

cookies-layer/
└── cookies/
    └── cookies.txt

ascii-converter-layer/
└── bin/
    └── ascii-image-converter
```

## Security: YouTube Cookies

⚠️ **CRITICAL SECURITY NOTES:**

- **Never commit cookies.txt to version control** - it contains your authentication tokens
- The cookies layer contains sensitive data - treat it like a password
- Cookies expire periodically - you'll need to refresh them every few months
- Keep track of which AWS account has access to this layer
- Consider using AWS Secrets Manager for even better security in production

### Cookie Expiration

YouTube cookies typically expire after a few months. Signs that cookies need refreshing:
- yt-dlp starts failing with authentication errors
- Videos that should be accessible return "Sign in to confirm you're not a bot"
- Age-restricted videos fail to download

When this happens, simply re-export your cookies and rebuild/re-upload the layer.
