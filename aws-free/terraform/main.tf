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
  bucket = "fraud-platform-models-${data.aws_caller_identity.current.account_id}-sa"
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

resource "aws_iam_role" "lambda_fraud_role" {
  name = "lambda-fraud-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_fraud_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_s3_read" {
  role       = aws_iam_role.lambda_fraud_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_full" {
  role       = aws_iam_role.lambda_fraud_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_lambda_function" "fn_ml_predict" {
  function_name    = "fn-ml-predict"
  role             = aws_iam_role.lambda_fraud_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.9"
  filename         = "${path.module}/../lambdas/fn-ml-predict/function.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/fn-ml-predict/function.zip")
  timeout          = 3
  memory_size      = 128
  layers           = ["arn:aws:lambda:sa-east-1:336392948345:layer:AWSSDKPandas-Python39:13"]

  environment {
    variables = {
      MODELS_BUCKET = aws_s3_bucket.models.bucket
    }
  }
}

resource "aws_apigatewayv2_api" "fraud_api" {
  name          = "fraud-api"
  protocol_type = "HTTP"
}

# Recursos criados via "quick create" - não gerenciáveis pelo Terraform
# API ID: 80fg89umwc | Integration: ydjqlx7 | Route: clkpgc8 | Stage: $default
# CloudTrail confirma deletes aceitos mas sem efeito (comportamento AWS não documentado)
# Para recriar do zero: aws apigatewayv2 create-api --name fraud-api \
#   --protocol-type HTTP --target <lambda-arn> --region sa-east-1
