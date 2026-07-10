import requests
import time
import random
import uuid
import os
import sys

# Configure via variáveis de ambiente antes de rodar, por exemplo:
#   export API_URL="https://SUA-API-ID.execute-api.SUA-REGIAO.amazonaws.com"
#   export API_KEY="sua-api-key"
# IMPORTANTE: Não coloque o "?get_stats=true" na API_URL, pois esse script ENVIA dados (POST)
API_URL = os.environ.get("API_URL")
API_KEY = os.environ.get("API_KEY")

if not API_URL or not API_KEY:
    print("Defina as variáveis de ambiente API_URL e API_KEY antes de rodar este script.")
    sys.exit(1)

def enviar_transacao():
    # Simulando nomes da sua família e amigos para ficar real
    clientes = ["Carol Zolet", "Pedro", "Lucca", "Elis Regina", "Antonia"]
    
    # Sorteia um valor. Se for acima de 50.000, sua Lambda deve marcar como FRAUDE
    valor = random.choice([120, 450, 1500, 55000, 890, 92000]) 
    
    payload = {
        "transaction_id": str(uuid.uuid4()),
        "cliente": random.choice(clientes),
        "valor": valor,
        "tipo": "PIX"
    }

    print(f"🚀 Enviando: {payload['cliente']} | R$ {payload['valor']}...", end="")

    try:
        # Faz o POST para a AWS
        response = requests.post(API_URL, json=payload, headers={"x-api-key": API_KEY}, timeout=10)
        
        if response.status_code == 200:
            print(" ✅ Sucesso!")
        else:
            print(f" ❌ Erro {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f" ⚠️ Falha: {e}")

# Loop que roda para sempre até você apertar Ctrl+C
print("--- Simulador de Transações Real-time ---")
print("Pressione Ctrl+C para parar\n")

while True:
    enviar_transacao()
    time.sleep(10) # Espera 10 segundos para a próxima (para dar tempo do Grafana atualizar)