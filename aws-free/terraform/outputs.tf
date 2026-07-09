output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.fraud.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.api.id
}

output "sqs_raw_url" {
  value = aws_sqs_queue.transactions_raw.url
}

output "sqs_predictions_url" {
  value = aws_sqs_queue.transactions_predictions.url
}

output "dynamodb_table" {
  value = aws_dynamodb_table.audit_logs.name
}

output "models_bucket" {
  value = aws_s3_bucket.models.bucket
}

output "lambda_function_name" {
  value = aws_lambda_function.fn_ml_predict.function_name
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.fraud_api.api_endpoint
}
