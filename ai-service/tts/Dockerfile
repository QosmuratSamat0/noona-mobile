# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Install runtime dependencies for ONNX and audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app
COPY . .

# Non-root user
RUN adduser --disabled-password --gecos "" tts
RUN mkdir -p /tmp/noona_tts && chown tts:tts /tmp/noona_tts
RUN mkdir -p models && chown tts:tts models

USER tts

# Environment defaults
ENV HOST=0.0.0.0 \
    PORT=8002 \
    GRPC_PORT=50052 \
    LOG_LEVEL=info \
    PIPER_MODEL=en_US-lessac-medium.onnx \
    MODELS_DIR=models \
    USE_CUDA=false \
    MINIO_ENDPOINT=minio:9000 \
    MINIO_ACCESS_KEY=admin \
    MINIO_SECRET_KEY=password \
    MINIO_BUCKET=voice-output

EXPOSE 8002
EXPOSE 50052

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')"

CMD ["python", "main.py"]
