# Fraud Platform

Plataforma de detecção de fraudes em transações financeiras em tempo real, construída como arquitetura de microsserviços orientada a eventos (Kafka), com um modelo de Machine Learning (XGBoost) servindo predições de fraude em tempo real.

## Arquitetura

Fluxo de uma transação, do cliente até o dashboard de monitoramento:

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│  Cliente │─────▶│  API Gateway │─────▶│ Auth Service │
│ (POST)   │ JWT? │  (NestJS)    │ login│  (NestJS)    │
└──────────┘      │  :3000       │◀─────│  :3002       │
                   └──────┬───────┘      └──────────────┘
                          │ publica
                          ▼
                 ┌──────────────────┐
                 │       Kafka       │
                 │  transactions.raw │
                 └────────┬──────────┘
                          │ consome
                          ▼
                 ┌──────────────────┐
                 │   ML Serving      │
                 │   (FastAPI)       │
                 │   :8000           │
                 │  XGBoost + Scaler │
                 └────────┬──────────┘
                          │ publica
                          ▼
              ┌─────────────────────────┐
              │          Kafka           │
              │ transactions.predictions │
              └────────────┬─────────────┘
                           │ consome
                           ▼
                  ┌──────────────────┐
                  │  Audit Service    │
                  │  (NestJS)         │
                  │  :3003            │
                  │  → PostgreSQL     │
                  └──────────────────┘
```

Infraestrutura de suporte (observabilidade e dados): PostgreSQL, MongoDB, Redis, Zookeeper, MLflow, Prometheus, Grafana e Kafka UI — todos orquestrados via `docker-compose.yml`.

## Serviços e portas

| Serviço | Tecnologia | Porta (host) | Descrição |
|---|---|---|---|
| `api-gateway` | NestJS | `3000` | Recebe transações, valida JWT, publica no Kafka (`transactions.raw`) |
| `auth-service` | NestJS | `3002` | Autentica usuário/senha, emite JWT |
| `audit-service` | NestJS | `3003` | Consome predições do Kafka, persiste no PostgreSQL, expõe consultas |
| `ml-serving` | FastAPI (Python) | `8000` | Serve o modelo XGBoost — prediz fraude via HTTP e via consumo Kafka |
| `postgres` | PostgreSQL 16 | `5433`→5432 | Armazena `audit_logs` (registro imutável de transações) |
| `mongo` | MongoDB 7.0 | `27017` | Reservado para logs (ainda não consumido por nenhum serviço) |
| `redis` | Redis 7.2 | `6379` | Reservado para cache de features em tempo real (ainda não consumido) |
| `kafka` | Confluent Kafka 7.6 | `29092` (host) / `9092` (interno) | Barramento de eventos entre os serviços |
| `zookeeper` | Confluent Zookeeper 7.6 | interno | Coordenação do cluster Kafka |
| `kafka-setup` | — | — | Job one-shot: cria os tópicos Kafka na subida do stack |
| `mlflow` | MLflow 2.13 | `5000` | Versionamento/tracking de modelos |
| `prometheus` | Prometheus v2.52 | `9090` | Coleta de métricas |
| `grafana` | Grafana 10.4 | `3001`→3000 | Dashboards |
| `kafka-ui` | Kafka UI | `8080` | Inspeção visual dos tópicos/mensagens Kafka |

Tópicos Kafka usados: `transactions.raw`, `transactions.features`, `transactions.predictions`, `transactions.dead-letter`.

## Como rodar

### Pré-requisitos

- Docker e Docker Compose (Docker Desktop no Windows/Mac)
- ~10GB de espaço livre em disco (imagens + volumes)
- Portas `3000`, `3001`, `3002`, `3003`, `5433`, `6379`, `8000`, `8080`, `9090`, `27017`, `29092` livres no host

### Subindo o stack

```bash
# 1. Copie o arquivo de exemplo e ajuste se necessário
cp .env.example .env

# 2. Suba tudo (infraestrutura + os 4 serviços da aplicação)
docker compose up --build -d

# 3. Acompanhe os logs se quiser
docker compose logs -f

# 4. Verifique o status de cada serviço
docker compose ps
```

Também há um `Makefile` com atalhos: `make up`, `make down`, `make logs`, `make ps`.

Na primeira subida, o `kafka-setup` cria os tópicos automaticamente e sai (`Exited (0)` é o comportamento esperado, não um erro). O `docker/postgres/init.sql` cria a tabela `audit_logs` no Postgres.

## Testando o fluxo end-to-end

Com o stack no ar, o fluxo completo (login → transação → predição → auditoria) pode ser testado com 3 chamadas:

### 1. Login no `auth-service` (obter token JWT)

```bash
curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Retorna `access_token` e os dados do usuário. Usuários disponíveis (em memória, ver `auth-service/src/users/users.service.ts`): `admin`, `analyst`, `viewer` — todos com a mesma senha de teste.

### 2. Enviar uma transação no `api-gateway` (usando o token)

```bash
TOKEN="<access_token retornado no passo 1>"

curl -s -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 15000, "merchant": "Loja Teste", "location": "Porto Alegre"}'
```

A transação é publicada no tópico Kafka `transactions.raw`. O `ml-serving` a consome, roda o modelo XGBoost e publica o resultado em `transactions.predictions`.

### 3. Conferir se a predição chegou no `audit-service`

```bash
# Aguarde alguns segundos para o pipeline assíncrono processar
curl -s http://localhost:3003/audit/stats

curl -s "http://localhost:3003/audit?limit=5"
```

`/audit/stats` retorna `{ total, frauds, normal, fraudRate }`; `/audit?limit=N` retorna os registros mais recentes, incluindo o score de fraude (`fraudScore`) calculado pelo modelo.

## Status atual

### ✅ Implementado e funcionando (testado end-to-end)

- **api-gateway**: recebe transações, valida JWT, publica no Kafka.
- **auth-service**: login com usuário/senha (bcrypt), emite JWT.
- **audit-service**: consome predições do Kafka (dois listeners redundantes), persiste em `audit_logs` no Postgres, expõe `GET /audit`, `/audit/frauds`, `/audit/stats`.
- **ml-serving**: carrega modelo XGBoost + scaler reais (treinados em `notebooks/`), serve `POST /predict` e consome/produz Kafka.
- **Stack completo via Docker Compose**: todos os 14 serviços (4 de aplicação + 10 de infraestrutura) sobem com `docker compose up --build -d`, com Dockerfiles e `.dockerignore` para os 4 serviços de aplicação.
- **Pipeline de eventos**: Kafka conectando os serviços via `KAFKA_BROKER` (variável de ambiente, não mais hardcoded).
- **JWT_SECRET compartilhado** entre `auth-service` e `api-gateway` via `.env` e `@nestjs/config`.

### ⚠️ Parcial / conhecido como pendente

- **Feature Service**: mencionado na arquitetura (cálculo de features em tempo real com Redis), mas a pasta `services/` está vazia — não implementado.
- **MongoDB e Redis**: definidos no `docker-compose.yml` e sobem saudáveis, mas nenhum serviço grava neles ainda.
- **Explicabilidade (SHAP)**: mencionada na visão de arquitetura, não implementada no `ml-serving`.
- **JWT em HS256 com secret simétrico**: existe um par de chaves RSA em `keys/` (não usado) — a arquitetura original previa RS256.
- **Autenticação fraca**: usuários e senha de teste hardcoded em memória no `auth-service` (`users.service.ts`), sem persistência real nem hashing de senha por usuário.
- **Trilha AWS (`aws-free/`)**: implementação alternativa (Lambda + Cognito + DynamoDB + Terraform) rodando em paralelo à trilha Docker/Kafka principal — não integrada a este stack.
- **Trilha GCP/GKE (`terraform/`, `k8s/`)**: manifests e Terraform definidos para deploy em GKE, mas não testados nesta sessão.
- **CI/CD (`.github/workflows/deploy.yml`)**: builda e testa `auth-service`/`api-gateway` e faz deploy no GKE — não validado neste ambiente.

## Variáveis de ambiente

Definidas em `.env` (use `.env.example` como modelo — **nunca** commite o `.env` real):

| Variável | Usada por | Descrição |
|---|---|---|
| `JWT_SECRET` | `auth-service`, `api-gateway` | Segredo simétrico para assinar/verificar o JWT (precisa ser igual nos dois) |
| `KAFKA_BROKER` | `api-gateway`, `audit-service`, `ml-serving` | Endereço do broker Kafka — `kafka:9092` dentro do Docker, `localhost:29092` rodando fora do Docker |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres`, `audit-service`, `mlflow` | Credenciais do banco principal |
| `MONGO_USER` / `MONGO_PASSWORD` | `mongo` | Credenciais do MongoDB (ainda não consumido por nenhum serviço) |
| `REDIS_PASSWORD` | `redis` | Senha do Redis (ainda não consumido por nenhum serviço) |
| `GRAFANA_USER` / `GRAFANA_PASSWORD` | `grafana` | Login do dashboard Grafana |

## Estrutura de pastas

```
fraud-platform/
├── docker-compose.yml       # Orquestra todos os 14 serviços
├── Makefile                 # Atalhos (up, down, logs, ps)
├── .env / .env.example       # Variáveis de ambiente
│
├── api-gateway/              # NestJS — recebe transações, valida JWT, publica no Kafka
├── auth-service/             # NestJS — login e emissão de JWT
├── audit-service/            # NestJS — consome predições, persiste no Postgres
├── ml-serving/                # FastAPI — serve o modelo XGBoost
│   ├── main.py
│   ├── requirements.txt
│   └── models/                # scaler.pkl e xgboost_fraud.pkl (copiados de notebooks/)
│
├── services/                  # Reservado para o Feature Service — vazio, não implementado
│
├── docker/                    # Configuração da infraestrutura local
│   ├── postgres/init.sql       # Cria a tabela audit_logs
│   ├── prometheus/prometheus.yml
│   └── grafana/provisioning/
│
├── notebooks/                  # Análise exploratória e treino do modelo (Jupyter)
│   ├── 01_analise_exploratoria.ipynb
│   ├── data/creditcard.csv
│   └── models/                 # Modelo original treinado
│
├── k8s/                        # Manifests Kubernetes (trilha GCP/GKE)
├── terraform/                  # Infra GCP (GKE, Cloud SQL, VPC)
├── aws-free/                   # Trilha alternativa: Lambda + Cognito + DynamoDB
│   ├── lambdas/
│   └── terraform/
│
├── keys/                       # Par de chaves RSA (não utilizado atualmente)
├── .github/workflows/deploy.yml  # CI/CD (build + deploy GKE)
├── App.jsx                     # Diagrama interativo da arquitetura (React, standalone)
├── index.html                  # Dashboard estático (FraudWatch), consome a trilha AWS
└── simulador_fraude.py          # Script para gerar tráfego de teste contra a API AWS
```
