"""
Application configuration — loaded from environment variables.
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
    port: int = Field(default=8002)
    log_level: str = Field(default="info")

    # ── gRPC ─────────────────────────────────────────────────────────────────
    grpc_host: str = Field(default="0.0.0.0")
    grpc_port: int = Field(default=50052)

    # ── Piper TTS ────────────────────────────────────────────────────────────
    # Path to the .onnx model file
    piper_model: str = Field(default="en_US-lessac-medium.onnx")
    # Directory where models are stored
    models_dir: str = Field(default="models")
    # Whether to use CUDA if available
    use_cuda: bool = Field(default=False)

    # ── MinIO ────────────────────────────────────────────────────────────────
    minio_endpoint: str = Field(default="localhost:9000")
    minio_access_key: str = Field(default="admin")
    minio_secret_key: str = Field(default="password")
    minio_use_ssl: bool = Field(default=False)
    minio_bucket: str = Field(default="voice-output")
    minio_presigned_expiry: int = Field(default=3600)  # 1 hour

    # ── Concurrency ──────────────────────────────────────────────────────────
    max_workers: int = Field(default=10)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor — safe to call anywhere."""
    return Settings()
