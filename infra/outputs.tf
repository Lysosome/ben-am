# Output important values for deployment and configuration

output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = data.aws_region.current.name
}

output "aws_account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

# DynamoDB
output "dynamodb_table_name" {
  description = "DynamoDB table name for calendar data"
  value       = aws_dynamodb_table.calendar.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.calendar.arn
}

# S3 Buckets
output "assets_bucket_name" {
  description = "S3 bucket name for songs, DJ messages, thumbnails, and reviews"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  description = "S3 bucket ARN for assets"
  value       = aws_s3_bucket.assets.arn
}

output "frontend_bucket_name" {
  description = "S3 bucket name for frontend static hosting"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "S3 bucket ARN for frontend"
  value       = aws_s3_bucket.frontend.arn
}

# Lambda Functions
output "alexa_skill_lambda_arn" {
  description = "ARN of Alexa Skill Lambda function (use this in Alexa Developer Console)"
  value       = aws_lambda_function.alexa_skill.arn
}

output "alexa_skill_lambda_name" {
  description = "Name of Alexa Skill Lambda function"
  value       = aws_lambda_function.alexa_skill.function_name
}

output "api_lambda_arn" {
  description = "ARN of API Lambda function"
  value       = aws_lambda_function.api.arn
}

output "api_lambda_name" {
  description = "Name of API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "youtube_dl_lambda_arn" {
  description = "ARN of YouTube-DL Lambda function"
  value       = aws_lambda_function.youtube_dl.arn
}

output "youtube_dl_lambda_name" {
  description = "Name of YouTube-DL Lambda function"
  value       = aws_lambda_function.youtube_dl.function_name
}

# API Gateway
output "api_gateway_url" {
  description = "Base URL for API Gateway (use this in frontend config)"
  value       = "${aws_api_gateway_stage.main.invoke_url}"
}

output "api_gateway_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_stage" {
  description = "API Gateway stage name"
  value       = aws_api_gateway_stage.main.stage_name
}

# CloudFront
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (use for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name for accessing the frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_url" {
  description = "Full HTTPS URL for the frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

# SES
output "ses_sender_email" {
  description = "SES verified sender email address"
  value       = aws_ses_email_identity.sender.email
}

output "ses_verification_status" {
  description = "SES email verification status (check AWS Console to verify)"
  value       = "Email verification pending - check ${var.ses_email_sender} inbox"
}

# Deployment Instructions
output "deployment_instructions" {
  description = "Quick deployment instructions"
  value = <<-EOT
  
  ═══════════════════════════════════════════════════════════════
  
  🎉 Ben AM Infrastructure Deployed Successfully!
  
  ═══════════════════════════════════════════════════════════════
  
  📋 NEXT STEPS:
  
  1. Verify SES Email:
     - Check ${var.ses_email_sender} for verification email
     - Click the verification link
  
  2. Build and Deploy Frontend:
     cd frontend
     npm run build
     aws s3 sync dist/ s3://${aws_s3_bucket.frontend.id} --delete
     aws cloudfront create-invalidation \
       --distribution-id ${aws_cloudfront_distribution.frontend.id} \
       --paths "/*"
  
  3. Configure Alexa Skill:
     - Go to https://developer.amazon.com/alexa/console/ask
     - Create new custom skill with invocation name "Ben AM"
     - Set Lambda ARN: ${aws_lambda_function.alexa_skill.arn}
  
  4. Update Frontend API URL:
     - Set API base URL in frontend: ${aws_api_gateway_stage.main.invoke_url}
  
  5. Access Your App:
     - Frontend: ${aws_cloudfront_distribution.frontend.domain_name}
     - API: ${aws_api_gateway_stage.main.invoke_url}
  
  ═══════════════════════════════════════════════════════════════
  EOT
}
