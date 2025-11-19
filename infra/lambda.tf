# Archive backend code for deployment (includes dist + node_modules)
data "archive_file" "alexa_skill_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/alexa-skill"
  output_path = "${path.module}/.terraform/lambda-packages/alexa-skill.zip"
  
  excludes = [
    "src",
    "*.ts",
    "tsconfig.json",
    ".gitignore",
    "README.md",
  ]
}

data "archive_file" "api_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/api"
  output_path = "${path.module}/.terraform/lambda-packages/api.zip"
  
  excludes = [
    "src",
    "*.ts",
    "tsconfig.json",
    ".gitignore",
    "README.md",
  ]
}

data "archive_file" "youtube_dl_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/youtube-dl"
  output_path = "${path.module}/.terraform/lambda-packages/youtube-dl.zip"
  
  excludes = [
    "src",
    "*.ts",
    "tsconfig.json",
    ".gitignore",
    "README.md",
  ]
}

# Lambda function for Alexa Skill
resource "aws_lambda_function" "alexa_skill" {
  function_name    = "${local.resource_prefix}-alexa-skill"
  role             = aws_iam_role.alexa_skill_lambda.arn
  handler          = "dist/index.handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = 512
  filename         = data.archive_file.alexa_skill_lambda.output_path
  source_code_hash = data.archive_file.alexa_skill_lambda.output_base64sha256

  environment {
    variables = {
      TABLE_NAME      = local.table_name
      S3_BUCKET       = local.assets_bucket
      SES_EMAIL_SENDER = var.ses_email_sender
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  tags = {
    Name = "${local.resource_prefix}-alexa-skill"
  }
}

# CloudWatch Log Group for Alexa Skill
resource "aws_cloudwatch_log_group" "alexa_skill" {
  name              = "/aws/lambda/${local.resource_prefix}-alexa-skill"
  retention_in_days = 14

  tags = {
    Name = "${local.resource_prefix}-alexa-skill-logs"
  }
}

# Lambda permission for Alexa to invoke the skill
resource "aws_lambda_permission" "alexa_skill" {
  statement_id  = "AllowExecutionFromAlexa"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alexa_skill.function_name
  principal     = "alexa-appkit.amazon.com"
  # Optional: Add event_source_token with your Alexa Skill ID for additional security
  # event_source_token = "amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}

# Lambda function for API
resource "aws_lambda_function" "api" {
  function_name    = "${local.resource_prefix}-api"
  role             = aws_iam_role.api_lambda.arn
  handler          = "dist/index.handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = 512
  filename         = data.archive_file.api_lambda.output_path
  source_code_hash = data.archive_file.api_lambda.output_base64sha256

  environment {
    variables = {
      TABLE_NAME               = local.table_name
      S3_BUCKET                = local.assets_bucket
      SES_EMAIL_SENDER         = var.ses_email_sender
      YOUTUBE_DL_LAMBDA_ARN    = aws_lambda_function.youtube_dl.arn
      DATE_LOCK_TTL_MINUTES    = var.date_lock_ttl_minutes
      MAX_SONG_DURATION_SECONDS = var.max_song_duration_seconds
      MAX_DJ_RECORDING_SECONDS = var.max_dj_recording_seconds
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  tags = {
    Name = "${local.resource_prefix}-api"
  }
}

# CloudWatch Log Group for API
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.resource_prefix}-api"
  retention_in_days = 14

  tags = {
    Name = "${local.resource_prefix}-api-logs"
  }
}

# Lambda function for YouTube-DL
resource "aws_lambda_function" "youtube_dl" {
  function_name    = "${local.resource_prefix}-youtube-dl"
  role             = aws_iam_role.youtube_dl_lambda.arn
  handler          = "dist/index.handler"
  runtime          = var.lambda_runtime
  timeout          = var.youtube_dl_timeout
  memory_size      = 2048 # Higher memory for video processing
  filename         = data.archive_file.youtube_dl_lambda.output_path
  source_code_hash = data.archive_file.youtube_dl_lambda.output_base64sha256
  
  # Lambda layers for yt-dlp and ffmpeg binaries
  layers = [
    "arn:aws:lambda:us-east-1:668596205778:layer:yt-dlp-binary:2",
    "arn:aws:lambda:us-east-1:668596205778:layer:ffmpeg-binary:1",
    "arn:aws:lambda:us-east-1:668596205778:layer:youtube-cookies:1"
  ]

  ephemeral_storage {
    size = 2048 # 2GB temporary storage for downloads
  }

  environment {
    variables = {
      S3_BUCKET                = local.assets_bucket
      TABLE_NAME               = local.table_name
      MAX_SONG_DURATION_SECONDS = var.max_song_duration_seconds
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  tags = {
    Name = "${local.resource_prefix}-youtube-dl"
  }
}

# CloudWatch Log Group for YouTube-DL
resource "aws_cloudwatch_log_group" "youtube_dl" {
  name              = "/aws/lambda/${local.resource_prefix}-youtube-dl"
  retention_in_days = 14

  tags = {
    Name = "${local.resource_prefix}-youtube-dl-logs"
  }
}

# Note: Lambda layers for youtube-dl/yt-dlp and ffmpeg binaries
# should be created separately and referenced here.
# Example:
# resource "aws_lambda_layer_version" "youtube_dl_binary" {
#   filename   = "youtube-dl-layer.zip"
#   layer_name = "youtube-dl-binary"
#   compatible_runtimes = [var.lambda_runtime]
# }
#
# Then add to youtube_dl Lambda:
# layers = [aws_lambda_layer_version.youtube_dl_binary.arn, aws_lambda_layer_version.ffmpeg.arn]
