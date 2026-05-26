# Noona AI — Getting Started & Testing Guide

This project is a voice-powered microservice architecture consisting of a Go Backend, a React/Vite Frontend, and Python-based AI Services (STT and TTS).

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- [Docker & Docker Compose](https://www.docker.com/)
- [Go 1.21+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)
- [Goose](https://github.com/pressly/goose) (Go database migration tool)
- Make (optional, but recommended for executing commands via the `Makefile`)

---

## 🚀 Setup & Launching the Project

Follow these steps in order to start all components:

### 1. Configure Environment Variables
Copy the template environment files and customize them:
```bash
# Root directory (.env)
cp .env.example .env

# Backend directory (backend/.env)
cp backend/.env.example backend/.env
```
*Note: Set your `GEMINI_API_KEY` inside `backend/.env` for AI capabilities.*

### 2. Start Infrastructure & AI Services
Launch PostgreSQL, Redis, MinIO, STT, and TTS services using Docker Compose:
```bash
docker compose up -d
```

### 3. Run Database Migrations
Apply backend database migrations using Goose:
```bash
# Via Makefile
make migrate

# Or manually from the backend folder
cd backend && goose -dir migrations postgres "postgres://postgres:postgres@localhost:5432/noona?sslmode=disable" up
```

### 4. Run the Go Backend
Start the backend server in development mode:
```bash
# Via Makefile
make dev

# Or manually from the backend folder
cd backend && go run cmd/api/main.go
```
*The server will start listening on `http://localhost:8080`.*

### 5. Run the Web Frontend
Start the React development server:
```bash
cd frontend-web
npm install
npm run dev
```
*The frontend client will run on `http://localhost:5173` (or the port specified by Vite).*

---

## 🧪 Testing & Verification

### 1. API Documentation (Swagger)
You can view and test the HTTP API interactively via the built-in Swagger UI:
- **URL**: `http://localhost:8080/docs/index.html`

### 2. AI Services Health Check
To ensure the STT and TTS services are online and ready:
- **STT Service Status**: `http://localhost:8001/health`
- **TTS Service Status**: `http://localhost:8002/health`

### 3. Infrastructure Check
- **PostgreSQL**: Standard port `5432`
- **Redis**: Standard port `6379`
- **MinIO Console**: `http://localhost:9001` (Credentials: `admin` / `password`)

---

## 🛠 Helper Commands

Use the following commands from the root directory for development tasks:

| Command | Description |
|---|---|
| `make dev` | Starts Go backend locally |
| `make migrate` | Applies database migrations |
| `make migrate-down` | Rolls back the latest database migration |
| `make stt-dev` | Runs Python STT service locally |
| `make proto` | Re-generates gRPC protobuf files |
