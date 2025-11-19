# YouTube Cookies Security Documentation

## Overview
The Ben AM project requires YouTube authentication cookies for the yt-dlp downloader to bypass bot detection and access videos reliably. This document explains the security setup and maintenance procedures.

## What Was Implemented

### 1. Security Measures
- ✅ `cookies.txt` added to `.gitignore` (root and lambda-layers)
- ✅ Cookies packaged as a private Lambda layer
- ✅ Lambda layer uploaded to AWS (not in version control)
- ✅ YouTube-DL Lambda configured to use cookies via `--cookies` parameter

### 2. Lambda Layer Structure
```
cookies-layer/
└── cookies/
    └── cookies.txt    # Your YouTube authentication cookies
```

The cookies file is accessible to the Lambda at: `/opt/cookies/cookies.txt`

### 3. Code Changes
The youtube-dl Lambda (`backend/youtube-dl/src/index.ts`) now includes:
- `COOKIES_FILE` constant pointing to `/opt/cookies/cookies.txt`
- All yt-dlp commands include `--cookies` parameter
- Works alongside iOS client spoofing for maximum reliability

## Maintenance: Updating Cookies

### When to Update
YouTube cookies expire periodically (typically every few months). Update when you see:
- yt-dlp authentication errors in CloudWatch logs
- "Sign in to confirm you're not a bot" errors
- Age-restricted videos failing to download
- Increased download failures

### How to Update

#### Step 1: Export Fresh Cookies
1. Install a cookie export browser extension:
   - **Chrome/Edge**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - **Firefox**: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. Sign in to YouTube in your browser
3. Navigate to youtube.com
4. Click the extension and export cookies in **Netscape format**
5. Save as `lambda-layers/cookies.txt` (overwrite the old file)

#### Step 2: Rebuild and Upload the Layer
```bash
cd lambda-layers

# Build the updated cookies layer
./build-cookies-layer.sh

# Upload to AWS (creates new version)
aws lambda publish-layer-version \
  --layer-name youtube-cookies \
  --zip-file fileb://cookies-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1
```

Note the version number returned (e.g., `"Version": 2`).

#### Step 3: Update Terraform Configuration
Edit `infra/lambda.tf` and update the cookies layer version:

```terraform
layers = [
  "arn:aws:lambda:us-east-1:668596205778:layer:yt-dlp-binary:2",
  "arn:aws:lambda:us-east-1:668596205778:layer:ffmpeg-binary:1",
  "arn:aws:lambda:us-east-1:668596205778:layer:youtube-cookies:2"  # Update version here
]
```

#### Step 4: Deploy the Update
```bash
cd infra
terraform apply -var-file=terraform.staging.tfvars -target=aws_lambda_function.youtube_dl
```

For production:
```bash
terraform apply -target=aws_lambda_function.youtube_dl
```

#### Step 5: Verify
Test the youtube-dl Lambda with a video:
```bash
aws lambda invoke \
  --function-name ben-am-staging-youtube-dl \
  --payload '{"jobId":"test-123","date":"2025-12-01","youtubeURL":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","maxDuration":600}' \
  --region us-east-1 \
  response.json

# Check CloudWatch logs
aws logs tail /aws/lambda/ben-am-staging-youtube-dl --follow
```

## Security Best Practices

### ✅ DO:
- Keep `cookies.txt` local and never commit to git
- Rotate cookies every 2-3 months proactively
- Monitor CloudWatch logs for authentication errors
- Delete old Lambda layer versions periodically
- Use IAM policies to restrict who can access the layer

### ❌ DON'T:
- Commit `cookies.txt` or `cookies-layer.zip` to version control
- Share the cookies layer ARN publicly
- Use cookies from an account you don't control
- Forget to update staging AND production environments

## Troubleshooting

### "cookies.txt not found" during build
**Solution**: Ensure you've created `lambda-layers/cookies.txt` before running the build script.

### "Permission denied" on build script
**Solution**: Make it executable:
```bash
chmod +x lambda-layers/build-cookies-layer.sh
```

### Downloads still failing after cookie update
**Possible causes**:
1. Cookies not exported correctly (must be Netscape format)
2. Not signed in to YouTube when exporting
3. YouTube account has restrictions
4. Old layer version still attached (check Terraform)

**Solution**: Re-export cookies while signed in, rebuild layer, verify Terraform updated the version.

### "Rate limit exceeded" errors
**Solution**: YouTube may be rate-limiting your IP. Wait a few hours or use a different account.

## Alternative: AWS Secrets Manager (Production Recommended)

For production deployments, consider storing cookies in AWS Secrets Manager instead of a Lambda layer:

### Advantages:
- Automatic rotation support
- Audit trail of access
- No redeployment needed to update cookies
- Encrypted at rest and in transit

### Implementation:
1. Store cookies in Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name ben-am/youtube-cookies \
  --secret-string file://lambda-layers/cookies.txt \
  --region us-east-1
```

2. Update Lambda code to fetch from Secrets Manager:
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});
const cookiesContent = await secretsClient.send(
  new GetSecretValueCommand({ SecretId: 'ben-am/youtube-cookies' })
);
await writeFile('/tmp/cookies.txt', cookiesContent.SecretString);
```

3. Grant Lambda permission to read the secret (add to IAM role)

This approach is more secure but adds complexity and AWS Secrets Manager costs ($0.40/month per secret + $0.05 per 10,000 API calls).

## Current Deployment Status

- **Layer Name**: `youtube-cookies`
- **Current Version**: 1
- **ARN**: `arn:aws:lambda:us-east-1:668596205778:layer:youtube-cookies:1`
- **Attached to**: `ben-am-staging-youtube-dl` Lambda
- **Cookie File Path**: `/opt/cookies/cookies.txt`
- **Last Updated**: November 16, 2025

## Next Steps

1. Set a calendar reminder to refresh cookies in **2 months** (January 16, 2026)
2. Monitor CloudWatch logs weekly for authentication errors
3. Consider implementing Secrets Manager approach for production
4. Document which Google account's cookies are being used
5. Update production environment with the same cookies layer

---

**Questions?** Refer to `lambda-layers/README.md` for more technical details.
