include .env
export

DB_DSN=postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/$(POSTGRES_DB)?sslmode=disable

.PHONY: migrate migrate-down migrate-status dev build proto stt-dev

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

# ── Proto generation ──────────────────────────────────────────────────────────
# Requires: pip install grpcio-tools  &&  go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
#           go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
proto:
	bash ./scripts/generate_proto.sh

# ── Run Python STT service locally ────────────────────────────────────────────
stt-dev:
	cd ai-service/stt && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
