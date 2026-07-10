variable "aws_region" {
  description = "Região AWS canônica da trilha (unificada em sa-east-1)"
  type        = string
  default     = "sa-east-1"
}

variable "db_password" {
  description = "Senha do banco de dados (sem default — deve ser fornecida via TF_VAR_db_password ou tfvars não versionado)"
  type        = string
  sensitive   = true
}

variable "api_key" {
  description = "API key exigida no header x-api-key pela Lambda fn-ml-predict (default vazio só para evitar prompt interativo no CI — o valor real vem de TF_VAR_api_key)"
  type        = string
  sensitive   = true
  default     = ""
}
