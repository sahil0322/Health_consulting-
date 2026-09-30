.PHONY: up down seed logs test build

up:
	docker compose up --build

down:
	docker compose down -v

seed:
	docker compose exec backend python -m app.seed

logs:
	docker compose logs -f

test:
	cd backend && pytest -v

build:
	cd frontend && npm run build && npm run smoke-test
