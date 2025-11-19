# IAM role for Alexa Skill Lambda
resource "aws_iam_role" "alexa_skill_lambda" {
  name = "${local.resource_prefix}-alexa-skill-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.resource_prefix}-alexa-skill-lambda-role"
  }
}

# Policy for Alexa Skill Lambda
resource "aws_iam_role_policy" "alexa_skill_lambda" {
  name = "${local.resource_prefix}-alexa-skill-lambda-policy"
  role = aws_iam_role.alexa_skill_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Read from DynamoDB
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.calendar.arn
      },
      # Generate pre-signed URLs for S3 objects
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.assets.arn}/*"
      },
      # Write review recordings to S3
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.assets.arn}/reviews/*"
      },
      # Send emails via SES
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.ses_email_sender
          }
        }
      },
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.resource_prefix}-alexa-skill:*"
      }
    ]
  })
}

# IAM role for API Lambda
resource "aws_iam_role" "api_lambda" {
  name = "${local.resource_prefix}-api-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.resource_prefix}-api-lambda-role"
  }
}

# Policy for API Lambda
resource "aws_iam_role_policy" "api_lambda" {
  name = "${local.resource_prefix}-api-lambda-policy"
  role = aws_iam_role.api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Full DynamoDB access for calendar operations
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.calendar.arn
      },
      # Write to S3 (for DJ recordings, temp files)
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.assets.arn}/*"
      },
      # Invoke youtube-dl Lambda
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.youtube_dl.arn
      },
      # Send emails via SES (for review notifications)
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.ses_email_sender
          }
        }
      },
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.resource_prefix}-api:*"
      }
    ]
  })
}

# IAM role for YouTube-DL Lambda
resource "aws_iam_role" "youtube_dl_lambda" {
  name = "${local.resource_prefix}-youtube-dl-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.resource_prefix}-youtube-dl-lambda-role"
  }
}

# Policy for YouTube-DL Lambda
resource "aws_iam_role_policy" "youtube_dl_lambda" {
  name = "${local.resource_prefix}-youtube-dl-lambda-policy"
  role = aws_iam_role.youtube_dl_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Write processed files to S3
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.assets.arn}/songs/*",
          "${aws_s3_bucket.assets.arn}/thumbnails/*",
          "${aws_s3_bucket.assets.arn}/temp/*"
        ]
      },
      # Update DynamoDB with processing status
      {
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.calendar.arn
      },
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.resource_prefix}-youtube-dl:*"
      }
    ]
  })
}
