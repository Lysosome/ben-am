# Lambda Layers for YouTube Download

This directory contains scripts to build Lambda layers for yt-dlp, ffmpeg, and YouTube cookies.

## Layers Needed

1. **yt-dlp**: YouTube video downloader
2. **ffmpeg**: Audio/video processing
3. **youtube-cookies**: YouTube authentication cookies (sensitive)

## Building the Layers

### 1. Build yt-dlp Layer

```bash
cd lambda-layers
./build-yt-dlp-layer.sh
```

### 2. Build ffmpeg Layer

```bash
cd lambda-layers
./build-ffmpeg-layer.sh
```

### 3. Build Cookies Layer (Required for YouTube Authentication on AWS)


It seems from [this thread](https://github.com/yt-dlp/yt-dlp/issues/12475) that Youtube actively blocks datacenter IP's (e.g., AWS Lambda server IP's). A workaround is to provide your Youtube account cookies. For more information, see [here](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies).

First, export your YouTube cookies from your browser:

1. Install a browser extension to export cookies:
   - Chrome/Edge: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. Sign in to YouTube in your browser

3. Use the extension to export cookies in Netscape format

4. Save as `cookies.txt` in this directory (`lambda-layers/cookies.txt`)

5. Build the cookies layer:

```bash
cd lambda-layers
./build-cookies-layer.sh
```

### 4. Upload to AWS

```bash
# Upload yt-dlp layer
aws lambda publish-layer-version \
  --layer-name yt-dlp-binary \
  --description "yt-dlp binary for Lambda" \
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
```

After uploading, update the layer ARNs in `infra/lambda.tf`.

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
