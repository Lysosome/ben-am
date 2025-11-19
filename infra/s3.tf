# S3 bucket for assets (songs, DJ messages, thumbnails, reviews)
resource "aws_s3_bucket" "assets" {
  bucket = local.assets_bucket

  tags = {
    Name        = "${local.resource_prefix}-assets"
    Description = "Storage for songs and media files"
  }
}

# Block public access to assets bucket
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for assets bucket
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle policy for assets bucket
resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  # Delete temp/intermediate files after 30 days
  rule {
    id     = "delete-temp-files"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = var.s3_lifecycle_temp_file_days
    }
  }

  # Transition old reviews to Infrequent Access after 90 days
  rule {
    id     = "transition-reviews"
    status = "Enabled"

    filter {
      prefix = "reviews/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# CORS configuration for assets bucket (for direct browser uploads)
resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # TODO: Restrict to CloudFront domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# S3 bucket for frontend static hosting
resource "aws_s3_bucket" "frontend" {
  bucket = local.frontend_bucket

  tags = {
    Name        = "${local.resource_prefix}-frontend"
    Description = "Static hosting for React frontend"
  }
}

# Block public access to frontend bucket (CloudFront will access via OAI)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for frontend bucket
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Website configuration for frontend bucket
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # SPA routing - all errors go to index.html
  }
}

# CloudFront Origin Access Identity for frontend bucket
resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "OAI for ${local.resource_prefix} frontend"
}

# Bucket policy to allow CloudFront access to frontend
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}
