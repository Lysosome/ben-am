variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "ben-am"
}

variable "table_name" {
  description = "DynamoDB table name for calendar data"
  type        = string
  default     = "ben-am-calendar"
}

variable "assets_bucket_name" {
  description = "S3 bucket name for songs, DJ messages, thumbnails, and reviews"
  type        = string
  default     = "ben-am-assets"
}

variable "frontend_bucket_name" {
  description = "S3 bucket name for frontend static hosting"
  type        = string
  default     = "ben-am-frontend"
}

variable "ses_email_sender" {
  description = "Verified SES email address for sending review emails"
  type        = string
  # Must be provided via terraform.tfvars or -var flag
}

variable "domain_name" {
  description = "Optional custom domain for CloudFront (leave empty for default CloudFront domain)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for custom domain (must be in us-east-1)"
  type        = string
  default     = ""
}

variable "s3_lifecycle_temp_file_days" {
  description = "Number of days before temp files are deleted"
  type        = number
  default     = 30
}

variable "date_lock_ttl_minutes" {
  description = "TTL in minutes for date lock records"
  type        = number
  default     = 15
}

variable "lambda_runtime" {
  description = "Node.js runtime version for Lambda functions"
  type        = string
  default     = "nodejs20.x"
}

variable "lambda_timeout" {
  description = "Default timeout in seconds for Lambda functions"
  type        = number
  default     = 30
}

variable "youtube_dl_timeout" {
  description = "Timeout in seconds for YouTube download Lambda"
  type        = number
  default     = 300
}

variable "max_song_duration_seconds" {
  description = "Maximum allowed song duration in seconds (10 minutes)"
  type        = number
  default     = 600
}

variable "max_dj_recording_seconds" {
  description = "Maximum DJ recording duration in seconds"
  type        = number
  default     = 60
}
