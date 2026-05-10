include .env
export

DB_DSN=postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/$(POSTGRES_DB)?sslmode=disable

.PHONY: migrate migrate-down migrate-status dev build

dev:
	go run backend/cmd/api/main.go

build:
	go build -o backend/bin/main backend/cmd/api/main.go

migrate:
	goose -dir backend/migrations postgres "$(DB_DSN)" up

migrate-down:
	goose -dir backend/migrations postgres "$(DB_DSN)" down

migrate-status:
	goose -dir backend/migrations postgres "$(DB_DSN)" status
