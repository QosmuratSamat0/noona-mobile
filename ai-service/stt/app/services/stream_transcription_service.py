"""
STTServicer — gRPC delivery layer.

Implements STTServiceServicer from generated protobuf stubs.
Handles two audio formats per-stream:

  ENCODED (0)      — WebM / OGG / MP3 bytes streamed from Go (file-based).
                     Accumulated into a temp file, decoded by ffmpeg, then
                     passed to Whisper in one shot after end_of_stream.

  RAW_PCM_S16LE (1) — Raw 16-kHz mono int16 bytes (real-time mic).
                     Fed chunk-by-chunk through Silero VAD; each detected
                     speech segment is transcribed immediately and streamed
                     back as a partial TranscriptResult.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncIterator

import grpc
import numpy as np

from app.adapters.vad_processor import VADRingBuffer, load_silero_vad
from app.adapters.whisper_model import ModelHandle, run_transcription
from app.config import Settings
from app.proto import stt_pb2, stt_pb2_grpc

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000 


class STTServicer(stt_pb2_grpc.STTServiceServicer):
    """
    gRPC servicer for real-time and file-based speech-to-text.
    One instance is shared across all concurrent streams.
    """

    def __init__(self, model_handle: ModelHandle, settings: Settings) -> None:
        self._model = model_handle
        self._settings = settings
        self._executor = ThreadPoolExecutor(max_workers=settings.whisper_num_workers)

        self._vad_model = None
        try:
            self._vad_model, _ = load_silero_vad()
            logger.info("Silero VAD loaded successfully.")
        except Exception as exc:
            logger.warning(
                "Silero VAD not available (%s). RAW_PCM streams will use "
                "Whisper built-in VAD instead.",
                exc,
            )

        logger.info("STTServicer initialised (device=%s)", model_handle.device)


    async def Health(
        self,
        request: stt_pb2.HealthRequest,
        context: grpc.aio.ServicerContext,
    ) -> stt_pb2.HealthResponse:
        return stt_pb2.HealthResponse(
            status="ok",
            model_size=self._model.model_size,
            device=self._model.device,
            compute_type=self._model.compute_type,
        )


    async def TranscribeStream(
        self,
        request_iterator: grpc.aio.ServicerContext,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[stt_pb2.TranscriptResult]:
        """
        Bidirectional streaming RPC.
        Dispatches to the correct handler based on the first chunk's format.
        """
        first_chunk: stt_pb2.AudioChunk | None = None
        async for chunk in request_iterator:
            first_chunk = chunk
            break

        if first_chunk is None:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "empty stream")
            return

        fmt = first_chunk.format  

        if fmt == stt_pb2.AudioFormat.Value("RAW_PCM_S16LE"):
            async for result in self._handle_raw_pcm(
                first_chunk, request_iterator, context
            ):
                yield result
        else:
            async for result in self._handle_encoded(
                first_chunk, request_iterator, context
            ):
                yield result


    async def _handle_encoded(
        self,
        first_chunk: stt_pb2.AudioChunk,
        request_iterator,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[stt_pb2.TranscriptResult]:
        """
        Collect all ENCODED audio bytes into a temp file, then run Whisper.
        Yields a single final TranscriptResult.
        """
        tmp_dir = self._settings.tmp_dir
        os.makedirs(tmp_dir, exist_ok=True)
        tmp_path = os.path.join(tmp_dir, f"{uuid.uuid4()}.audio")

        language = first_chunk.language or (self._settings.whisper_language or None)

        try:
            with open(tmp_path, "wb") as f:
                if first_chunk.data:
                    f.write(first_chunk.data)

                if not first_chunk.end_of_stream:
                    async for chunk in request_iterator:
                        if chunk.language and not language:
                            language = chunk.language
                        if chunk.data:
                            f.write(chunk.data)
                        if chunk.end_of_stream:
                            break

            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                self._transcribe_file,
                tmp_path,
                language,
            )

            if result is not None:
                yield result

        except Exception as exc:
            logger.exception("Error in _handle_encoded")
            await context.abort(grpc.StatusCode.INTERNAL, str(exc))
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    def _transcribe_file(
        self,
        audio_path: str,
        language: str | None,
    ) -> stt_pb2.TranscriptResult | None:
        """Blocking: run faster-whisper on a local file."""
        try:
            segments_iter, info = run_transcription(
                handle=self._model,
                audio_path=audio_path,
                language=language or None,
                beam_size=self._settings.whisper_beam_size,
                vad_filter=self._settings.vad_enabled,
                vad_threshold=self._settings.vad_threshold,
            )

            text_parts: list[str] = []
            proto_segments: list[stt_pb2.Segment] = []
            total_logprob = 0.0
            count = 0

            for seg in segments_iter:
                text = seg.text.strip()
                if text:
                    text_parts.append(text)
                    proto_segments.append(
                        stt_pb2.Segment(
                            start=seg.start,
                            end=seg.end,
                            text=text,
                        )
                    )
                    total_logprob += seg.avg_logprob
                    count += 1

            full_text = " ".join(text_parts)
            confidence = (total_logprob / count) if count else 0.0

            logger.info(
                "Transcription complete: lang=%s text_len=%d segments=%d",
                info.language,
                len(full_text),
                count,
            )

            return stt_pb2.TranscriptResult(
                text=full_text,
                is_final=True,
                language=info.language,
                confidence=confidence,
                segments=proto_segments,
            )

        except Exception as exc:
            logger.exception("Whisper transcription failed: %s", exc)
            return None


    async def _handle_raw_pcm(
        self,
        first_chunk: stt_pb2.AudioChunk,
        request_iterator,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[stt_pb2.TranscriptResult]:
        """
        Feed raw PCM chunks through Silero VAD.
        Each detected speech segment triggers a Whisper run and a partial result.
        end_of_stream flushes the VAD buffer.
        """
        language = first_chunk.language or (self._settings.whisper_language or None)
        loop = asyncio.get_running_loop()

        if self._vad_model is not None:
            vad = VADRingBuffer(
                model=self._vad_model,
                threshold=self._settings.vad_threshold,
            )

            async def process_chunk_vad(chunk: stt_pb2.AudioChunk):
                nonlocal language
                if chunk.language and not language:
                    language = chunk.language
                if chunk.end_of_stream:
                    audio = vad.flush()
                elif chunk.data:
                    audio = vad.push(chunk.data)
                else:
                    return None
                if audio is None:
                    return None
                return await loop.run_in_executor(
                    self._executor, self._transcribe_pcm, audio, language
                )

            try:
                result = await process_chunk_vad(first_chunk)
                if result:
                    yield result
                if not first_chunk.end_of_stream:
                    async for chunk in request_iterator:
                        result = await process_chunk_vad(chunk)
                        if result:
                            yield result
                        if chunk.end_of_stream:
                            break
            except Exception as exc:
                logger.exception("Error in _handle_raw_pcm (VAD path)")
                await context.abort(grpc.StatusCode.INTERNAL, str(exc))
        else:
            pcm_chunks: list[bytes] = []
            if first_chunk.data:
                pcm_chunks.append(first_chunk.data)
            if not first_chunk.end_of_stream:
                async for chunk in request_iterator:
                    if chunk.language and not language:
                        language = chunk.language
                    if chunk.data:
                        pcm_chunks.append(chunk.data)
                    if chunk.end_of_stream:
                        break

            if not pcm_chunks:
                return

            raw_bytes = b"".join(pcm_chunks)
            audio = (
                np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            )

            try:
                result = await loop.run_in_executor(
                    self._executor, self._transcribe_pcm, audio, language
                )
                if result:
                    yield result
            except Exception as exc:
                logger.exception("Error in _handle_raw_pcm (no-VAD path)")
                await context.abort(grpc.StatusCode.INTERNAL, str(exc))

    def _transcribe_pcm(
        self,
        audio: np.ndarray,
        language: str | None,
    ) -> stt_pb2.TranscriptResult | None:
        """Blocking: transcribe a float32 numpy array via faster-whisper."""
        try:
            segments_iter, info = self._model.model.transcribe(
                audio,
                language=language or None,
                beam_size=self._settings.whisper_beam_size,
                word_timestamps=False,
            )

            text_parts: list[str] = []
            proto_segments: list[stt_pb2.Segment] = []
            total_logprob = 0.0
            count = 0

            for seg in segments_iter:
                text = seg.text.strip()
                if text:
                    text_parts.append(text)
                    proto_segments.append(
                        stt_pb2.Segment(start=seg.start, end=seg.end, text=text)
                    )
                    total_logprob += seg.avg_logprob
                    count += 1

            full_text = " ".join(text_parts)
            confidence = (total_logprob / count) if count else 0.0

            logger.info(
                "PCM transcription: lang=%s text_len=%d", info.language, len(full_text)
            )

            return stt_pb2.TranscriptResult(
                text=full_text,
                is_final=True,
                language=info.language,
                confidence=confidence,
                segments=proto_segments,
            )

        except Exception as exc:
            logger.exception("PCM transcription failed: %s", exc)
            return None
