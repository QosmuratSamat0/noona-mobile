"""
gRPC servicer — delivery layer.
Implements TTSServiceServicer from generated stubs.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncIterator

import grpc
from app.adapters.minio_adapter import MinioAdapter
from app.adapters.piper_handler import ModelHandle, synthesize_stream
from app.config import Settings
from app.proto import tts_pb2, tts_pb2_grpc

logger = logging.getLogger(__name__)


class TTSServicer(tts_pb2_grpc.TTSServiceServicer):
    """
    gRPC servicer for TTS.
    Orchestrates Piper for synthesis and MinIO for persistence.
    """

    def __init__(
        self,
        model_handle: ModelHandle,
        minio: MinioAdapter,
        settings: Settings
    ) -> None:
        if model_handle is None:
            raise RuntimeError("TTSServicer requires a loaded Piper model")

        self._model = model_handle
        self._minio = minio
        self._settings = settings
        self._executor = ThreadPoolExecutor(max_workers=settings.max_workers)
        
        self._init_storage()

    def _init_storage(self):
        """Initialize MinIO bucket and lifecycle policy."""
        try:
            self._minio.ensure_bucket(self._settings.minio_bucket)
            self._minio.set_lifecycle_policy(self._settings.minio_bucket, days=1)
        except Exception as e:
            logger.error(f"Failed to initialize storage: {e}")

    async def StreamSpeech(
        self,
        request: tts_pb2.SpeechRequest,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[tts_pb2.AudioChunk]:
        """
        Synthesize text to speech and stream back audio chunks.
        Also saves the full audio to MinIO for history.
        """
        file_id = str(uuid.uuid4())
        object_name = f"{file_id}.wav"
        tmp_dir = "/tmp/noona_tts"
        os.makedirs(tmp_dir, exist_ok=True)
        local_path = os.path.join(tmp_dir, object_name)

        logger.info(f"Synthesizing speech for text: {request.text[:50]}...")

        try:
            loop = asyncio.get_running_loop()
            url = await loop.run_in_executor(
                self._executor,
                self._minio.get_presigned_url,
                self._settings.minio_bucket,
                object_name,
                self._settings.minio_presigned_expiry
            )
            queue: asyncio.Queue[bytes | Exception | None] = asyncio.Queue()

            def producer():
                """Blocking Piper synthesis running in a separate thread."""
                try:
                    with wave.open(local_path, "wb") as wav_file:
                        wav_file.setnchannels(1)
                        wav_file.setsampwidth(2)  # 16-bit PCM
                        wav_file.setframerate(self._model.sample_rate)

                        for chunk in synthesize_stream(self._model, request.text):
                            wav_file.writeframes(chunk)
                            loop.call_soon_threadsafe(queue.put_nowait, chunk)
                    
                    loop.call_soon_threadsafe(queue.put_nowait, None)
                except Exception as e:
                    logger.exception("Error in piper producer thread")
                    loop.call_soon_threadsafe(queue.put_nowait, e)

            loop.run_in_executor(self._executor, producer)

            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    raise item
                yield tts_pb2.AudioChunk(data=item)

            yield tts_pb2.AudioChunk(data=b"", file_url=url)

            asyncio.create_task(self._upload_and_cleanup(local_path, object_name))

        except Exception as e:
            logger.exception("Error in StreamSpeech RPC")
            if os.path.exists(local_path):
                os.remove(local_path)
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def _upload_and_cleanup(self, local_path: str, object_name: str):
        """Upload the generated WAV file to MinIO and delete the local copy."""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                self._executor,
                self._minio.upload,
                self._settings.minio_bucket,
                object_name,
                local_path
            )
            logger.info(f"Successfully uploaded {object_name} to MinIO")
        except Exception as e:
            logger.error(f"Failed to upload {object_name} to MinIO: {e}")
        finally:
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except OSError:
                    pass
