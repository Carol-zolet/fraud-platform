import json
import boto3
import pickle
import numpy as np
import os
from datetime import datetime
from boto3.dynamodb.conditions import Attr

# Configuração de Região (sa-east-1, região canônica da trilha AWS)
REGION = "sa-east-1"

# Inicializa clientes AWS
s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)

BUCKET = os.environ.get("MODELS_BUCKET")
TABLE_NAME = "fraud-audit-logs"
API_KEY = os.environ.get("API_KEY")

# Carregamento do modelo IA (Warm Start)
def load_model():
    try:
        print(f"Baixando modelo de s3://{BUCKET}/xgboost_fraud.pkl")
        s3.download_file(BUCKET, "xgboost_fraud.pkl", "/tmp/model.pkl")
        with open("/tmp/model.pkl", "rb") as f:
            return pickle.load(f)
    except Exception as e:
        print(f"Aviso: Modelo não carregado. Erro: {e}")
        return None

model = load_model()

def lambda_handler(event, context):
    headers_in = event.get("headers") or {}
    provided_key = headers_in.get("x-api-key") or headers_in.get("X-Api-Key")
    if not API_KEY or provided_key != API_KEY:
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Não autorizado"})
        }

    table = dynamodb.Table(TABLE_NAME)

    try:
        # --- MODO MÉTRICAS (Para o Grafana Free Tier) ---
        # Se a URL for chamada com ?get_stats=true
        params = event.get("queryStringParameters") or {}
        if params.get("get_stats") == "true":
            scan_total = table.scan(Select='COUNT')
            scan_frauds = table.scan(
                FilterExpression=Attr('prediction').eq('fraud'),
                Select='COUNT'
            )
            
            stats = {
                "total_transacoes": scan_total.get('Count', 0),
                "total_fraudes": scan_frauds.get('Count', 0),
                "taxa_fraude": f"{(scan_frauds.get('Count', 0) / max(1, scan_total.get('Count', 0)) * 100):.2f}%",
                "status_nuvem": "online"
            }
            
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps(stats)
            }

        # --- MODO PREDIÇÃO (Fluxo normal de transação) ---
        body = event.get("body", "{}")
        if isinstance(body, str):
            body = json.loads(body)
            
        amount = float(body.get("amount", 0))
        txn_id = body.get("transaction_id", f"txn_{int(datetime.now().timestamp())}")
        merchant = body.get("merchant", "Loja Teste AWS")
        
        # Inteligência: Modelo real ou Fallback de segurança
        if model:
            features = np.array([amount] + [0]*28).reshape(1, -1)
            score = float(model.predict_proba(features)[0][1])
        else:
            # Fallback inteligente se o .pkl não estiver disponível
            score = 0.98 if amount > 5000 else 0.02

        prediction = "fraud" if score > 0.5 else "normal"
        
        # Preparar registro para o DynamoDB
        result = {
            "transaction_id": str(txn_id),
            "created_at": datetime.now().isoformat(),
            "amount": str(amount),
            "prediction": str(prediction),
            "score": str(round(score, 4)),
            "merchant": str(merchant)
        }
        
        # Salva no DynamoDB
        table.put_item(Item=result)
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json", 
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(result)
        }

    except Exception as e:
        print(f"Erro: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Erro interno", "details": str(e)})
        }