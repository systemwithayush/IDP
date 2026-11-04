.PHONY: dev test lint typecheck db-up db-down db-migrate db-seed kind-up clean

dev:
	npm run dev

test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

db-up:
	docker compose -f infra/docker-compose.yml up -d

db-down:
	docker compose -f infra/docker-compose.yml down

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

kind-up:
	kind create cluster --config infra/kind-config.yaml

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules dist build

