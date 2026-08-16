"""
main.py cria um KafkaProducer real e inicia uma thread com KafkaConsumer real
no nível de módulo (executam na importação, não dentro de uma função) — sem
um Kafka de verdade rodando isso trava/derruba os testes. Substituímos o
módulo `kafka` por um mock ANTES de qualquer teste importar main.py; o Python
só executa o código de nível de módulo uma vez, na primeira importação, então
isso precisa acontecer aqui no conftest (carregado antes da coleta dos testes).
"""
import sys
from unittest.mock import MagicMock

mock_kafka_module = MagicMock()
# KafkaConsumer(...) é iterado com `for msg in consumer` dentro da thread de
# background — sem isso o mock não é iterável e gera um traceback (silencioso,
# já que é thread daemon, mas polui a saída dos testes à toa).
mock_kafka_module.KafkaConsumer.return_value.__iter__.return_value = iter([])

sys.modules["kafka"] = mock_kafka_module
