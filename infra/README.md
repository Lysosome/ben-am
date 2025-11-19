# Ben AM Infrastructure

Terraform configuration for deploying the complete Ben AM serverless infrastructure on AWS.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) v1.12.0 or higher
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- AWS account with permissions to create:
  - Lambda functions
  - API Gateway
  - DynamoDB tables
  - S3 buckets
  - CloudFront distributions
  - SES email identities
  - IAM roles and policies

## Quick Start

1. **Copy the example variables file:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit `terraform.tfvars` with your values:**
   - Set `ses_email_sender` to an email you control (required)
   - Optionally customize bucket names, region, etc.

3. **Initialize Terraform:**
   ```bash
   terraform init
   ```

4. **Review the planned changes:**
   ```bash
   terraform plan
   ```

5. **Deploy the infrastructure:**
   ```bash
   terraform apply
   ```

6. **Note the outputs:** Save the output values (Lambda ARNs, API URLs, CloudFront domain, etc.)

## Important Post-Deployment Steps

### 1. Verify SES Email
After deployment, AWS will send a verification email to the address you specified in `ses_email_sender`. Click the verification link before the system can send emails.

### 2. Build Lambda Functions
The Lambda functions expect compiled code in `backend/*/dist` directories:
```bash
cd ../backend
npm run build  # or build each workspace individually
```

### 3. Deploy Frontend
Build and upload the React frontend to S3:
```bash
cd ../frontend
npm run build
aws s3 sync dist/ s3://<frontend-bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

### 4. Configure Alexa Skill
1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Create a new custom skill
3. Set the invocation name to "Ben AM"
4. Configure the endpoint with the `alexa_skill_lambda_arn` from Terraform outputs
5. Optionally add the Alexa Skill ID to `lambda.tf` for additional security

## Infrastructure Components

### AWS Services Deployed

- **Lambda Functions (3)**
  - `ben-am-alexa-skill` - Alexa Skill handler
  - `ben-am-api` - REST API handlers
  - `ben-am-youtube-dl` - YouTube download/conversion

- **API Gateway** - REST API with CORS support
  - `GET /calendar` - Fetch calendar data
  - `POST /lock-date` - Lock a date for submission
  - `POST /submit-song` - Submit song metadata
  - `GET /status/{id}` - Poll processing status
  - `POST /reviews` - Submit review recordings

- **DynamoDB Table** - Calendar data with TTL for locks

- **S3 Buckets (2)**
  - Assets bucket - Songs, DJ messages, thumbnails, reviews
  - Frontend bucket - Static website hosting

- **CloudFront Distribution** - CDN for frontend with HTTPS

- **SES Configuration** - Email sending for review notifications

- **IAM Roles** - Least-privilege permissions for each Lambda

### File Structure

```
infra/
├── main.tf              # Provider and backend configuration
├── variables.tf         # Input variables
├── dynamodb.tf          # DynamoDB table definition
├── s3.tf                # S3 buckets and policies
├── iam.tf               # IAM roles and policies
├── lambda.tf            # Lambda function definitions
├── api-gateway.tf       # API Gateway routes and integrations
├── cloudfront.tf        # CloudFront distribution
├── ses.tf               # SES email configuration
├── outputs.tf           # Output values
├── terraform.tfvars.example  # Example variables file
└── .gitignore           # Git ignore patterns
```

## Terraform Workspaces

Use Terraform workspaces to manage multiple environments:

```bash
# Create and switch to dev workspace
terraform workspace new dev
terraform workspace select dev
terraform apply

# Create and switch to prod workspace
terraform workspace new prod
terraform workspace select prod
terraform apply
```

Each workspace maintains separate state and can have different variable values.

## Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `aws_region` | AWS region for resources | `us-east-1` | No |
| `project_name` | Project name prefix | `ben-am` | No |
| `table_name` | DynamoDB table name | `ben-am-calendar` | No |
| `assets_bucket_name` | S3 bucket for assets | `ben-am-assets` | No |
| `frontend_bucket_name` | S3 bucket for frontend | `ben-am-frontend` | No |
| `ses_email_sender` | Verified SES email | - | **Yes** |
| `domain_name` | Custom domain (optional) | `""` | No |
| `acm_certificate_arn` | ACM cert for custom domain | `""` | No |

See `variables.tf` for the complete list.

## Cost Estimates

Ben AM is designed to stay within AWS Free Tier limits for low traffic:

- **Lambda**: 1M requests/month free
- **API Gateway**: 1M requests/month free (12 months)
- **DynamoDB**: 25GB storage + 200M requests/month free
- **S3**: 5GB storage free (12 months)
- **CloudFront**: 50GB data transfer + 2M requests/month free (12 months)
- **SES**: 62,000 emails/month free when sending from EC2 (3,000/month otherwise)

Expected monthly cost for typical personal use: **$0-5**

## Security Considerations

- S3 buckets are private by default (CloudFront uses OAI)
- Lambda IAM roles follow least-privilege principle
- API Gateway has no authentication (add Cognito for production)
- CORS is configured to allow all origins (restrict in production)
- SES email is restricted to verified sender address

## Updating Infrastructure

After making changes to `.tf` files:

```bash
terraform plan    # Review changes
terraform apply   # Apply changes
```

To update Lambda code without Terraform:
```bash
# After building backend code
aws lambda update-function-code \
  --function-name ben-am-api \
  --zip-file fileb://../backend/api/dist.zip
```

## Destroying Infrastructure

To remove all resources:

```bash
terraform destroy
```

**Warning:** This will permanently delete all data including songs, DynamoDB records, and S3 objects.

## Troubleshooting

### Lambda deployment fails
- Ensure `backend/*/dist` directories exist and contain compiled code
- Run `npm run build:backend` from the project root

### SES emails not sending
- Verify the sender email in AWS SES Console
- Check if SES is in sandbox mode (can only send to verified addresses)
- Request production access for SES if needed

### CloudFront 403 errors
- Verify frontend files are uploaded to S3
- Check S3 bucket policy allows CloudFront OAI access

### API Gateway CORS issues
- Verify OPTIONS methods are deployed
- Check CORS headers in API Gateway responses

## Support

For issues or questions:
- Check the main [README.md](../README.md)
- Review [tech-spec.md](../tech-spec.md)
- Open an issue on GitHub
