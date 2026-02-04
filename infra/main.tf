terraform {
  required_version = ">= 1.12.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Optional: Configure S3 backend for state management
  # backend "s3" {
  #   bucket = "ben-am-terraform-state"
  #   key    = "state/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = "chimera" # Adjust or remove as needed for your AWS CLI profile

  default_tags {
    tags = {
      Project     = "Ben-AM"
      Environment = terraform.workspace
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for AWS region
data "aws_region" "current" {}

# Local variables for resource naming
locals {
  # Use workspace suffix for non-default workspaces
  env_suffix = terraform.workspace == "default" ? "" : "-${terraform.workspace}"
  
  # Resource name prefix that includes environment
  resource_prefix = "${var.project_name}${local.env_suffix}"
  
  # Table and bucket names that need environment suffix
  table_name          = "${var.table_name}${local.env_suffix}"
  assets_bucket       = "${var.assets_bucket_name}${local.env_suffix}-${data.aws_caller_identity.current.account_id}"
  frontend_bucket     = "${var.frontend_bucket_name}${local.env_suffix}-${data.aws_caller_identity.current.account_id}"
}
