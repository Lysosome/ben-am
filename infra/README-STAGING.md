# Staging vs Production Environments

## Overview
This project now has separate staging and production environments to keep test data isolated from real user data.

## Environments

### Staging (for development/testing)
- **DynamoDB Table**: `ben-am-calendar-staging`
- **S3 Buckets**: `ben-am-assets-staging-*`, `ben-am-frontend-staging-*`
- **Lambda Functions**: `ben-am-staging-*`
- **API Gateway**: https://s2tv7i8ac9.execute-api.us-east-1.amazonaws.com/staging

### Production (for real users)
- **DynamoDB Table**: `ben-am-calendar`
- **S3 Buckets**: `ben-am-assets-*`, `ben-am-frontend-*`
- **Lambda Functions**: `ben-am-*`
- **API Gateway**: (your production URL)

## Switching Between Environments

### To work with staging (default for local dev):
```bash
cd infra
terraform workspace select staging
terraform apply -var-file=terraform.staging.tfvars
```

### To work with production:
```bash
cd infra
terraform workspace select default
terraform apply -var-file=terraform.tfvars
```

### To check current workspace:
```bash
cd infra
terraform workspace show
```

## Local Development Setup

Your `template.yaml` is now configured to use:
- **Staging DynamoDB**: `ben-am-calendar-staging`
- **Staging S3**: `ben-am-assets-staging-668596205778`
- **Deployed YouTube-DL Lambda**: `arn:aws:lambda:us-east-1:668596205778:function:ben-am-staging-youtube-dl`

This means:
✅ Your local SAM API will read/write to staging DynamoDB
✅ Your local SAM API will invoke the real deployed YouTube downloader Lambda
✅ Production data remains untouched

## Deploying Changes

### Deploy to Staging:
```bash
# 1. Build backend
npm run build:backend

# 2. Switch to staging workspace
cd infra
terraform workspace select staging

# 3. Apply changes
terraform apply -var-file=terraform.staging.tfvars
```

### Deploy to Production (use caution!):
```bash
# 1. Build backend
npm run build:backend

# 2. Switch to production workspace
cd infra
terraform workspace select default

# 3. Apply changes (REVIEW CAREFULLY!)
terraform apply -var-file=terraform.tfvars
```

## Testing the YouTube Downloader

With the current setup, when you submit a song locally:
1. Your local API Lambda runs via SAM
2. It writes to `ben-am-calendar-staging` DynamoDB
3. It invokes the **deployed** `ben-am-staging-youtube-dl` Lambda
4. That Lambda downloads the video and stores it in `ben-am-assets-staging-*` S3 bucket

You can monitor the YouTube downloader Lambda logs:
```bash
aws logs tail /aws/lambda/ben-am-staging-youtube-dl --follow
```

## Important Notes

⚠️ **Never commit `terraform.tfstate` to git** - it contains sensitive information
⚠️ **Always verify which workspace you're in** before applying changes
⚠️ Production workspace is `default`, staging is `staging`
