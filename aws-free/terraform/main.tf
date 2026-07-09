terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_cognito_user_pool" "fraud" {
  name = "fraud-platform-users"
  password_policy {
    minimum_length    = 8
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }
}

resource "aws_cognito_user_pool_client" "api" {
  name         = "fraud-api-client"
  user_pool_id = aws_cognito_user_pool.fraud.id
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

resource "aws_sqs_queue" "transactions_raw" {
  name                      = "transactions-raw"
  message_retention_seconds = 86400
}

resource "aws_sqs_queue" "transactions_predictions" {
  name                      = "transactions-predictions"
  message_retention_seconds = 86400
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "models" {
  bucket = "fraud-platform-models-${data.aws_caller_identity.current.account_id}"
}

resource "aws_dynamodb_table" "audit_logs" {
  name         = "fraud-audit-logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transaction_id"
  range_key    = "created_at"

  attribute {
    name = "transaction_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }
}
