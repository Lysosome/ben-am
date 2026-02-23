#!/bin/bash
# Deploy script for Ben AM infrastructure and application

set -e  # Exit on error

# Parse environment argument (default to production)
ENVIRONMENT="${1:-production}"

echo "════════════════════════════════════════════════════════════"
echo "  Ben AM Deployment Script - ${ENVIRONMENT^^}"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if terraform.tfvars exists
if [ ! -f "infra/terraform.tfvars" ]; then
  echo -e "${RED}Error: infra/terraform.tfvars not found${NC}"
  echo "Please copy terraform.tfvars.example and configure your values:"
  echo "  cp infra/terraform.tfvars.example infra/terraform.tfvars"
  exit 1
fi

# Step 1: Install dependencies
echo -e "${GREEN}[1/6] Installing dependencies...${NC}"
npm install

# Step 2: Build backend Lambda functions
echo -e "${GREEN}[2/6] Building backend Lambda functions...${NC}"
npm run build:backend

# Step 3: Deploy infrastructure with Terraform
echo -e "${GREEN}[3/6] Deploying AWS infrastructure (${ENVIRONMENT})...${NC}"
cd infra
terraform init
terraform workspace select "${ENVIRONMENT}" || terraform workspace new "${ENVIRONMENT}"
terraform apply

# Capture outputs
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket_name)
CLOUDFRONT_DIST_ID=$(terraform output -raw cloudfront_distribution_id)
API_URL=$(terraform output -raw api_gateway_url)
CLOUDFRONT_URL=$(terraform output -raw cloudfront_url)

cd ..

# Step 4: Build frontend
echo -e "${GREEN}[4/6] Building frontend (${ENVIRONMENT} mode)...${NC}"
cd frontend

# Build with appropriate mode (uses .env.${ENVIRONMENT})
if [ "${ENVIRONMENT}" = "staging" ]; then
  npm run build:staging
elif [ "${ENVIRONMENT}" = "production" ]; then
  npm run build:production
else
  npm run build
fi

cd ..

# Step 5: Deploy frontend to S3
echo -e "${GREEN}[5/6] Deploying frontend to S3...${NC}"
aws s3 sync frontend/dist/ "s3://${FRONTEND_BUCKET}" --delete

# Step 6: Invalidate CloudFront cache
echo -e "${GREEN}[6/6] Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DIST_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Your application is now live at:"
echo -e "  ${GREEN}${CLOUDFRONT_URL}${NC}"
echo ""
echo "API Gateway URL:"
echo -e "  ${YELLOW}${API_URL}${NC}"
echo ""
echo -e "${YELLOW}Important: Don't forget to:${NC}"
echo "  1. Verify your SES email (check inbox)"
echo "  2. Configure Alexa Skill with Lambda ARN (see terraform outputs)"
echo ""
