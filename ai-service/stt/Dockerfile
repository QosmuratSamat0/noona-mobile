# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install Python deps into a clean layer
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps needed to compile some Python packages (e.g. ctranslate2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — minimal image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# ffmpeg is required at runtime by faster-whisper for audio decoding
# libsndfile1 is required at runtime by the Python soundfile package
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app
COPY . .

# Non-root user for security
RUN adduser --disabled-password --gecos "" stt
USER stt

# Pre-create the tmp dir with correct permissions
RUN mkdir -p /tmp/noona_stt

# Expose port and set env defaults
ENV HOST=0.0.0.0 \
    PORT=8001 \
    LOG_LEVEL=info \
    WHISPER_MODEL_SIZE=small \
    WHISPER_DEVICE=auto \
    WHISPER_COMPUTE_TYPE=auto \
    WHISPER_CPU_THREADS=2 \
    WHISPER_NUM_WORKERS=1 \
    VAD_ENABLED=true \
    VAD_THRESHOLD=0.5 \
    TMP_DIR=/tmp/noona_stt

EXPOSE 8001

# Healthcheck — useful for docker compose and K8s readiness probes
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
