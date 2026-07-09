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

resource "aws_iam_role_policy" "lambda_fraud_permissions" {
  name = "lambda-fraud-permissions"
  role = aws_iam_role.lambda_fraud_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.models.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan"]
        Resource = aws_dynamodb_table.audit_logs.arn
      }
    ]
  })
}

resource "aws_lambda_function" "fn_ml_predict" {
  function_name    = "fn-ml-predict"
  role             = aws_iam_role.lambda_fraud_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.11"
  filename         = "${path.module}/../lambdas/fn-ml-predict/function.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/fn-ml-predict/function.zip")
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      MODELS_BUCKET = aws_s3_bucket.models.bucket
    }
  }
}

resource "aws_apigatewayv2_api" "fraud_api" {
  name          = "fraud-platform-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "fraud_api_lambda" {
  api_id                 = aws_apigatewayv2_api.fraud_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fn_ml_predict.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "fraud_api_default" {
  api_id    = aws_apigatewayv2_api.fraud_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.fraud_api_lambda.id}"
}

resource "aws_apigatewayv2_stage" "fraud_api_default" {
  api_id      = aws_apigatewayv2_api.fraud_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn_ml_predict.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.fraud_api.execution_arn}/*/*"
}
