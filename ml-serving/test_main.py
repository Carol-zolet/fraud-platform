from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_health_returns_ok_status():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model": "xgboost_fraud_v1"}


def test_predict_returns_expected_shape_with_minimal_payload():
    response = client.post("/predict", json={})

    assert response.status_code == 200
    body = response.json()
    assert body["transaction_id"] == "sem-id"
    assert body["merchant"] == "Desconhecido"
    assert body["amount"] == 0.0
    assert body["prediction"] in ("fraud", "normal")
    assert 0.0 <= body["score"] <= 1.0
    assert body["is_fraud"] == (body["prediction"] == "fraud")


def test_predict_echoes_transaction_id_amount_and_merchant():
    response = client.post(
        "/predict",
        json={"transaction_id": "TXN-TEST-1", "amount": 250.75, "merchant": "Loja X"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transaction_id"] == "TXN-TEST-1"
    assert body["amount"] == 250.75
    assert body["merchant"] == "Loja X"


def test_predict_publishes_result_to_kafka():
    main.producer.send.reset_mock()

    client.post("/predict", json={"transaction_id": "TXN-KAFKA-1", "amount": 10})

    main.producer.send.assert_called_once()
    topic, payload = main.producer.send.call_args[0]
    assert topic == "transactions.predictions"
    assert payload["transaction_id"] == "TXN-KAFKA-1"


def test_predict_accepts_optional_computed_features():
    response = client.post(
        "/predict",
        json={
            "transaction_id": "TXN-FEATURES-1",
            "amount": 50,
            "hour_of_day": 3,
            "amount_above_average": True,
            "user_txn_count_24h": 7,
        },
    )

    assert response.status_code == 200


def test_predict_rejects_invalid_amount_type():
    response = client.post("/predict", json={"amount": "não-é-um-número"})

    assert response.status_code == 422
