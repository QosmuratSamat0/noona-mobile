include .env
export

DB_DSN=postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/$(POSTGRES_DB)?sslmode=disable

.PHONY: migrate migrate-down migrate-status dev build

dev:
	cd backend && go run cmd/api/main.go

build:
	cd backend && go build -o bin/main cmd/api/main.go

migrate:
	cd backend && goose -dir migrations postgres "$(DB_DSN)" up

migrate-down:
	goose -dir backend/migrations postgres "$(DB_DSN)" down

migrate-status:
	goose -dir backend/migrations postgres "$(DB_DSN)" status
