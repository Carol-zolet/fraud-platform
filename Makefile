# Makefile para facilitar comandos da plataforma
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

init-db:
	docker compose exec postgres psql -U fraud_user -d fraud_db -f /docker-entrypoint-initdb.d/01_init.sql
