"""
Application factory and lifespan manager.

Startup order:
  1. Load Settings
  2. Load Whisper model (singleton)
  3. Build MinIO adapter
  4. Build TranscriptionService (HTTP, for file-based requests)
  5. Start gRPC server as asyncio background task
  6. Register HTTP router

Shutdown: signal gRPC stop_event → graceful 5s drain.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.minio_adapter import MinioAdapter
from app.adapters.whisper_model import load_model
from app.config import get_settings
from app.delivery.http.router import router
from app.grpc_server import run_grpc_server
from app.services.transcription_service import TranscriptionService


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
    logger.info("STT service starting up…")

    model_handle = load_model(settings)

    minio = MinioAdapter(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        use_ssl=settings.minio_use_ssl,
    )

    app.state.transcription_service = TranscriptionService(
        model_handle=model_handle,
        minio=minio,
        settings=settings,
    )

    grpc_stop = asyncio.Event()
    grpc_task = asyncio.create_task(
        run_grpc_server(model_handle, settings, grpc_stop)
    )
    app.state.grpc_ready = False
    app.state.grpc_error = None

    def mark_grpc_done(task: asyncio.Task) -> None:
        app.state.grpc_ready = False
        try:
            exc = task.exception()
        except asyncio.CancelledError:
            return
        if exc is not None:
            app.state.grpc_error = str(exc)
            logger.error(
                "gRPC server task failed: %s",
                exc,
                exc_info=(type(exc), exc, exc.__traceback__),
            )
        elif not grpc_stop.is_set():
            app.state.grpc_error = "gRPC server task exited unexpectedly"
            logger.error("gRPC server task exited unexpectedly")

    grpc_task.add_done_callback(mark_grpc_done)
    await asyncio.sleep(0)
    app.state.grpc_ready = not grpc_task.done()

    logger.info(
        "STT ready: model=%s device=%s compute=%s grpc=:%d http=:%d",
        model_handle.model_size,
        model_handle.device,
        model_handle.compute_type,
        settings.grpc_port,
        settings.port,
    )

    yield  

    logger.info("STT service shutting down…")
    grpc_stop.set()
    await asyncio.wait_for(grpc_task, timeout=10)
    logger.info("STT service stopped.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Noona-AI STT Service",
        description=(
            "Dual-mode STT: HTTP (file path via MinIO) + gRPC streaming "
            "(bidirectional with Silero VAD). Powered by faster-whisper."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.get("/health", tags=["Health"], include_in_schema=False)
    async def root_health(response: Response):
        grpc_ready = bool(getattr(app.state, "grpc_ready", False))
        grpc_error = getattr(app.state, "grpc_error", None)
        if not grpc_ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return {
                "status": "degraded",
                "service": "stt",
                "grpc": "down",
                "error": grpc_error,
            }
        return {"status": "ok", "service": "stt", "grpc": "ok"}

    return app


app = create_app()
