"""
Application configuration — loaded from environment variables.
All settings have sensible defaults so the service starts out-of-the-box.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ───────────────────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8001)
    log_level: str = Field(default="info")

    # ── gRPC ─────────────────────────────────────────────────────────────────
    grpc_host: str = Field(default="0.0.0.0")
    grpc_port: int = Field(default=50051)

    # ── Whisper model ────────────────────────────────────────────────────────
    # small = best CPU/accuracy tradeoff for ru/kk/en
    whisper_model_size: Literal["tiny", "base", "small", "medium", "large-v3"] = Field(
        default="small"
    )
    # Override device: "auto" detects cuda at runtime, falls back to cpu
    whisper_device: Literal["auto", "cpu", "cuda"] = Field(default="auto")
    # Override compute type: "auto" picks float16 on cuda, int8 on cpu
    whisper_compute_type: Literal["auto", "int8", "float16", "float32"] = Field(
        default="auto"
    )
    # Number of CPU threads (should match container vCPU count)
    whisper_cpu_threads: int = Field(default=2, ge=1)
    # Number of workers inside CTranslate2 (1 = sequential, safe for low-RAM)
    whisper_num_workers: int = Field(default=1, ge=1)

    # ── VAD ──────────────────────────────────────────────────────────────────
    vad_enabled: bool = Field(default=True)
    # Minimum speech probability to keep a segment (0.5 = Silero default)
    vad_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

    # ── MinIO ────────────────────────────────────────────────────────────────
    minio_endpoint: str = Field(default="localhost:9000")
    minio_access_key: str = Field(default="admin")
    minio_secret_key: str = Field(default="password")
    minio_use_ssl: bool = Field(default=False)
    minio_default_bucket: str = Field(default="voice-input")

    # ── Temp storage ─────────────────────────────────────────────────────────
    tmp_dir: str = Field(default="/tmp/noona_stt")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor — safe to call anywhere."""
    return Settings()
