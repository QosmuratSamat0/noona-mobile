"""
Application factory and lifespan manager for TTS.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.minio_adapter import MinioAdapter
from app.adapters.piper_handler import load_model
from app.config import get_settings
from app.grpc_server import run_grpc_server


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    _configure_logging(settings.log_level)

    logger = logging.getLogger(__name__)
    logger.info("TTS service starting up…")

    model_handle = load_model(settings)

    minio = MinioAdapter(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        use_ssl=settings.minio_use_ssl,
        public_endpoint=settings.minio_public_endpoint,
    )

    grpc_stop = asyncio.Event()
    grpc_task = asyncio.create_task(
        run_grpc_server(model_handle, minio, settings, grpc_stop)
    )

    logger.info(
        "TTS ready: model=%s grpc=:%d http=:%d",
        settings.piper_model,
        settings.grpc_port,
        settings.port,
    )

    yield

    logger.info("TTS service shutting down…")
    grpc_stop.set()
    await asyncio.wait_for(grpc_task, timeout=10)
    logger.info("TTS service stopped.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Noona-AI TTS Service",
        description="Streaming TTS via Piper gRPC.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["Health"], include_in_schema=False)
    async def root_health():
        return {"status": "ok", "service": "tts"}

    return app


app = create_app()
