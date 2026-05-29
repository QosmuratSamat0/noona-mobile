"""
Async gRPC server — runs alongside FastAPI (HTTP health/docs).
Called from app/main.py lifespan.
"""
from __future__ import annotations

import asyncio
import logging

import grpc
from grpc import aio

from app.proto import stt_pb2_grpc
from app.services.stream_transcription_service import STTServicer
from app.adapters.whisper_model import ModelHandle
from app.config import Settings

logger = logging.getLogger(__name__)


async def run_grpc_server(
    model_handle: ModelHandle,
    settings: Settings,
    stop_event: asyncio.Event,
) -> None:
    """
    Create and serve the gRPC server until stop_event is set.
    Designed to run as an asyncio task alongside uvicorn.
    """
    try:
        servicer = STTServicer(model_handle=model_handle, settings=settings)
    except Exception as e:
        logger.error("CRITICAL: Failed to initialize STTServicer: %s", e, exc_info=True)
        return

    server = aio.server(
        options=[
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
            ("grpc.max_send_message_length", 10 * 1024 * 1024),
            ("grpc.keepalive_time_ms", 30_000),
            ("grpc.keepalive_timeout_ms", 10_000),
        ]
    )

    stt_pb2_grpc.add_STTServiceServicer_to_server(servicer, server)

    addr = f"{settings.grpc_host}:{settings.grpc_port}"
    server.add_insecure_port(addr)

    await server.start()
    logger.info("gRPC STT server listening on %s", addr)

    await stop_event.wait()

    logger.info("gRPC server shutting down…")
    await server.stop(grace=5) 
    logger.info("gRPC server stopped.")
