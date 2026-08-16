import pickle
import json
import os
from datetime import datetime, timezone
from typing import Optional
import numpy as np
from fastapi import Depends, FastAPI
from pydantic import BaseModel
from kafka import KafkaProducer, KafkaConsumer
import uvicorn
import threading

from auth import verify_jwt

app = FastAPI(title="ML Serving - Fraud Detection")

KAFKA_BROKER = os.environ.get("KAFKA_BROKER", "localhost:29092")

with open("models/xgboost_fraud.pkl", "rb") as f:
    model = pickle.load(f)
with open("models/scaler.pkl", "rb") as f:
    scaler = pickle.load(f)

print("Modelo carregado!")

producer = KafkaProducer(
    bootstrap_servers=[KAFKA_BROKER],
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

class Transaction(BaseModel):
    transaction_id: str = "sem-id"
    merchant: str = "Desconhecido"
    amount: float = 0.0
    V1: float = 0; V2: float = 0; V3: float = 0; V4: float = 0
    V5: float = 0; V6: float = 0; V7: float = 0; V8: float = 0
    V9: float = 0; V10: float = 0; V11: float = 0; V12: float = 0
    V13: float = 0; V14: float = 0; V15: float = 0; V16: float = 0
    V17: float = 0; V18: float = 0; V19: float = 0; V20: float = 0
    V21: float = 0; V22: float = 0; V23: float = 0; V24: float = 0
    V25: float = 0; V26: float = 0; V27: float = 0; V28: float = 0
    # Features calculadas pelo Feature Service (opcionais para chamadas diretas ao /predict)
    hour_of_day: Optional[int] = None
    amount_above_average: bool = False
    user_txn_count_24h: int = 0

@app.get("/health")
def health():
    return {"status": "ok", "model": "xgboost_fraud_v1"}

@app.post("/predict")
def predict(transaction: Transaction, _jwt_payload: dict = Depends(verify_jwt)):
    data = transaction.model_dump()
    amount_scaled = scaler.transform([[data["amount"]]])[0][0]
    hour_of_day = data["hour_of_day"] if data["hour_of_day"] is not None else datetime.now(timezone.utc).hour
    features = (
        [amount_scaled]
        + [data[f"V{i}"] for i in range(1, 29)]
        + [hour_of_day, int(data["amount_above_average"]), data["user_txn_count_24h"]]
    )
    X = np.array(features).reshape(1, -1)
    score = float(model.predict_proba(X)[0][1])
    prediction = "fraud" if score > 0.5 else "normal"
    result = {
        "transaction_id": data["transaction_id"],
        "amount": data["amount"],
        "prediction": prediction,
        "score": round(score, 4),
        "is_fraud": prediction == "fraud",
        "merchant": data["merchant"]
    }
    producer.send("transactions.predictions", result)
    print(f"Enviado ao Kafka: {data['transaction_id']} | {data['merchant']} | {prediction} | score={score:.4f}")
    return result

def consume_kafka():
    consumer = KafkaConsumer(
        "transactions.features",
        bootstrap_servers=[KAFKA_BROKER],
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="ml-serving",
        auto_offset_reset="latest"
    )
    print("Kafka consumer iniciado! Ouvindo transactions.features")
    for msg in consumer:
        transaction = msg.value
        try:
            amount = float(transaction.get("amount", 0))
            amount_scaled = scaler.transform([[amount]])[0][0]
            hour_of_day = transaction.get("hour_of_day")
            if hour_of_day is None:
                hour_of_day = datetime.now(timezone.utc).hour
            amount_above_average = int(bool(transaction.get("amount_above_average", False)))
            user_txn_count_24h = transaction.get("user_txn_count_24h", 0)
            features = (
                [amount_scaled] + [0] * 28
                + [hour_of_day, amount_above_average, user_txn_count_24h]
            )
            X = np.array(features).reshape(1, -1)
            score = float(model.predict_proba(X)[0][1])
            prediction = "fraud" if score > 0.5 else "normal"
            result = {
                "transaction_id": transaction.get("id", "kafka-msg"),
                "amount": amount,
                "prediction": prediction,
                "score": round(score, 4),
                "is_fraud": prediction == "fraud",
                "merchant": transaction.get("merchant", "Desconhecido")
            }
            producer.send("transactions.predictions", result)
            print(f"Kafka -> {prediction} score={score:.4f}")
        except Exception as e:
            print(f"Erro: {e}")

threading.Thread(target=consume_kafka, daemon=True).start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)