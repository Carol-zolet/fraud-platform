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
