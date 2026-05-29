"""
Async gRPC server for TTS.
"""
from __future__ import annotations

import asyncio
import logging

import grpc
from grpc import aio

from app.proto import tts_pb2_grpc
from app.services.speech_service import TTSServicer
from app.adapters.piper_handler import ModelHandle
from app.adapters.minio_adapter import MinioAdapter
from app.config import Settings

logger = logging.getLogger(__name__)


async def run_grpc_server(
    model_handle: ModelHandle,
    minio: MinioAdapter,
    settings: Settings,
    stop_event: asyncio.Event,
) -> None:
    """
    Create and serve the gRPC server until stop_event is set.
    """
    if model_handle is None:
        raise RuntimeError("TTS gRPC server cannot start without a Piper model")

    servicer = TTSServicer(
        model_handle=model_handle,
        minio=minio,
        settings=settings
    )

    server = aio.server(
        options=[
            ("grpc.max_receive_message_length", 10 * 1024 * 1024),
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
            ("grpc.keepalive_time_ms", 30_000),
            ("grpc.keepalive_timeout_ms", 10_000),
        ]
    )

    tts_pb2_grpc.add_TTSServiceServicer_to_server(servicer, server)

    addr = f"{settings.grpc_host}:{settings.grpc_port}"
    server.add_insecure_port(addr)

    await server.start()
    logger.info("gRPC TTS server listening on %s", addr)

    await stop_event.wait()

    logger.info("gRPC server shutting down…")
    await server.stop(grace=5)
    logger.info("gRPC server stopped.")
