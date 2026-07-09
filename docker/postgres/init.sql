-- Criação de tabelas iniciais para auditoria
CREATE DATABASE mlflow_db;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(64) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    is_fraud BOOLEAN NOT NULL DEFAULT false,
    fraud_score NUMERIC(5,4) NOT NULL DEFAULT 0,
    user_id VARCHAR(64),
    raw_payload JSONB,
    kafka_offset VARCHAR(64),
    kafka_partition INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
