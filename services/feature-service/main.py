import json
import os
import threading
from datetime import datetime, timezone

import redis
import uvicorn
from fastapi import FastAPI
from kafka import KafkaConsumer, KafkaProducer

KAFKA_BROKER = os.environ.get("KAFKA_BROKER", "localhost:29092")
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD") or None

DAY_SECONDS = 24 * 60 * 60

app = FastAPI(title="Feature Service - Fraud Detection")

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True,
)

producer = KafkaProducer(
    bootstrap_servers=[KAFKA_BROKER],
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)


@app.get("/health")
def health():
    try:
        redis_client.ping()
        redis_ok = True
    except Exception:
        redis_ok = False
    return {"status": "ok" if redis_ok else "degraded", "redis": redis_ok}


def compute_hour_of_day(transaction: dict) -> int:
    timestamp = transaction.get("timestamp")
    if timestamp:
        try:
            return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).hour
        except ValueError:
            pass
    return datetime.now(timezone.utc).hour


def compute_amount_above_average(amount: float) -> bool:
    """Compara com a média histórica (todas as transações vistas até aqui) e
    depois atualiza a média para incluir esta transação."""
    sum_key = "stats:amount:sum"
    count_key = "stats:amount:count"
    total = float(redis_client.get(sum_key) or 0)
    count = int(redis_client.get(count_key) or 0)
    average = (total / count) if count > 0 else amount
    above_average = amount > average
    redis_client.incrbyfloat(sum_key, amount)
    redis_client.incr(count_key)
    return above_average


def compute_user_txn_count_24h(user_id, txn_id) -> int:
    """Conta quantas transações do mesmo usuário ocorreram nas últimas 24h
    (antes desta), usando um sorted set no Redis com score = timestamp."""
    if user_id is None:
        return 0
    key = f"user:{user_id}:txns"
    now = datetime.now(timezone.utc).timestamp()
    window_start = now - DAY_SECONDS
    redis_client.zremrangebyscore(key, 0, window_start)
    count = redis_client.zcard(key)
    member = f"{now}:{txn_id}"
    redis_client.zadd(key, {member: now})
    redis_client.expire(key, DAY_SECONDS)
    return count


def process_transaction(transaction: dict) -> dict:
    amount = float(transaction.get("amount", 0))
    user_id = transaction.get("userId")
    txn_id = transaction.get("id")

    features = {
        "hour_of_day": compute_hour_of_day(transaction),
        "amount_above_average": compute_amount_above_average(amount),
        "user_txn_count_24h": compute_user_txn_count_24h(user_id, txn_id),
    }

    return {**transaction, **features}


def consume_kafka():
    consumer = KafkaConsumer(
        "transactions.raw",
        bootstrap_servers=[KAFKA_BROKER],
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="feature-service",
        auto_offset_reset="latest",
    )
    print("Feature Service - Kafka consumer iniciado! Ouvindo transactions.raw")
    for msg in consumer:
        transaction = msg.value
        try:
            enriched = process_transaction(transaction)
            producer.send("transactions.features", enriched)
            print(
                f"Features calculadas -> txn={transaction.get('id')} "
                f"hour={enriched['hour_of_day']} "
                f"above_avg={enriched['amount_above_average']} "
                f"count_24h={enriched['user_txn_count_24h']}"
            )
        except Exception as e:
            print(f"Erro ao calcular features: {e}")


threading.Thread(target=consume_kafka, daemon=True).start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
