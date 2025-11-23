# Customer-managed KMS key for Lambda environment variable encryption
resource "aws_kms_key" "lambda_env_vars" {
  description             = "KMS key for encrypting Lambda environment variables"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${local.resource_prefix}-lambda-kms"
  }
}

resource "aws_kms_alias" "lambda_env_vars" {
  name          = "alias/${local.resource_prefix}-lambda-env-vars"
  target_key_id = aws_kms_key.lambda_env_vars.key_id
}

# KMS key policy allowing Lambda roles to use it
resource "aws_kms_key_policy" "lambda_env_vars" {
  key_id = aws_kms_key.lambda_env_vars.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda service to use the key"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "lambda.${data.aws_region.current.name}.amazonaws.com"
            "kms:CallerAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "Allow youtube-dl Lambda role direct access"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.youtube_dl_lambda.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow API Lambda role direct access"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.api_lambda.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow Alexa Skill Lambda role direct access"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.alexa_skill_lambda.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}
