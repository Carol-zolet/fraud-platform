terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend parcial de propósito — o nome do bucket (que contém o account ID)
  # não fica hardcoded aqui, já que este código é público. Valor real vem de
  # fora via `terraform init -backend-config=backend.hcl` (arquivo gitignored,
  # veja backend.hcl.example para o template).
  backend "s3" {
    key            = "aws-free/terraform.tfstate"
    region         = "sa-east-1"
    dynamodb_table = "fraud-platform-terraform-locks"
    encrypt        = true
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
  function_name = "fn-ml-predict"
  role          = aws_iam_role.lambda_fraud_role.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.sa-east-1.amazonaws.com/fn-ml-predict:latest"
  timeout       = 15
  memory_size   = 512

  environment {
    variables = {
      MODELS_BUCKET = aws_s3_bucket.models.bucket
      API_KEY       = var.api_key
    }
  }
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "apigateway-access"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn_ml_predict.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.fraud_api.execution_arn}/*/*"
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

# ============================================================
# ECS: VPC, EC2, cluster e serviços do fraud-platform
# ============================================================

resource "aws_vpc" "fraud_ecs" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "fraud-platform-vpc" }
}

resource "aws_subnet" "fraud_ecs_public" {
  vpc_id                  = aws_vpc.fraud_ecs.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "sa-east-1a"
  map_public_ip_on_launch = true
  tags                    = { Name = "fraud-platform-public-subnet" }
}

resource "aws_internet_gateway" "fraud_ecs" {
  vpc_id = aws_vpc.fraud_ecs.id
  tags   = { Name = "fraud-platform-igw" }
}

resource "aws_route_table" "fraud_ecs_public" {
  vpc_id = aws_vpc.fraud_ecs.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.fraud_ecs.id
  }

  tags = { Name = "fraud-platform-public-rt" }
}

resource "aws_route_table_association" "fraud_ecs_public" {
  subnet_id      = aws_subnet.fraud_ecs_public.id
  route_table_id = aws_route_table.fraud_ecs_public.id
}

resource "aws_security_group" "fraud_ecs" {
  name        = "fraud-platform-ecs-sg"
  description = "Portas dos serviços do fraud-platform"
  vpc_id      = aws_vpc.fraud_ecs.id

  dynamic "ingress" {
    for_each = toset([3000, 3002, 3003, 8000, 8001, 3001, 9090])
    content {
      description = "Servico fraud-platform"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "fraud-platform-ecs-sg" }
}

data "aws_ami" "ecs_optimized" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }
}

resource "aws_iam_role" "ecs_instance" {
  name = "fraud-platform-ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "fraud-platform-ecs-instance-profile"
  role = aws_iam_role.ecs_instance.name
}

resource "aws_ecs_cluster" "fraud_platform" {
  name = "fraud-platform"
}

resource "aws_instance" "ecs_host" {
  ami                         = data.aws_ami.ecs_optimized.id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.fraud_ecs_public.id
  vpc_security_group_ids      = [aws_security_group.fraud_ecs.id]
  iam_instance_profile        = aws_iam_instance_profile.ecs_instance.name
  associate_public_ip_address = true

  user_data = <<-EOF
    #!/bin/bash
    echo ECS_CLUSTER=${aws_ecs_cluster.fraud_platform.name} >> /etc/ecs/ecs.config
  EOF

  tags = { Name = "fraud-platform-ecs-host" }
}

# Um t3.micro tem 1 vCPU / 1024MB RAM no total. As reservas de memória abaixo
# somam ~690MB para deixar folga para o agente ECS + Docker + SO — mesmo assim
# é uma margem apertada para 5 serviços simultâneos numa única instância.
locals {
  ecs_services = {
    "api-gateway"     = { port = 3000, memory = 150, cpu = 128 }
    "auth-service"    = { port = 3002, memory = 120, cpu = 128 }
    "audit-service"   = { port = 3003, memory = 120, cpu = 128 }
    "ml-serving"      = { port = 8000, memory = 180, cpu = 128 }
    "feature-service" = { port = 8001, memory = 120, cpu = 128 }
  }
}

resource "aws_ecr_repository" "services" {
  for_each = local.ecs_services
  name     = each.key
}

resource "aws_ecs_task_definition" "services" {
  for_each                 = local.ecs_services
  family                   = each.key
  requires_compatibilities = ["EC2"]
  network_mode             = "bridge"
  cpu                      = tostring(each.value.cpu)
  memory                   = tostring(each.value.memory)

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.services[each.key].repository_url}:latest"
      cpu       = each.value.cpu
      memory    = each.value.memory
      essential = true
      portMappings = [
        {
          containerPort = each.value.port
          hostPort      = each.value.port
          protocol      = "tcp"
        }
      ]
    }
  ])
}

resource "aws_ecs_service" "services" {
  for_each        = local.ecs_services
  name            = each.key
  cluster         = aws_ecs_cluster.fraud_platform.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = 1
  launch_type     = "EC2"

  depends_on = [aws_instance.ecs_host]
}
