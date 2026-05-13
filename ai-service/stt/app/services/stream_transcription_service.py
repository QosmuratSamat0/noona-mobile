"""
gRPC servicer — delivery layer.

Implements STTServiceServicer from generated stubs.
All business logic lives in adapters (VAD, Whisper); this class only wires them.

ENCODED audio path  (AudioFormat.ENCODED = 0):
  Accumulates raw file bytes → decodes to PCM via soundfile/ffmpeg →
  runs full VAD+Whisper on the decoded buffer.

RAW_PCM_S16LE path  (AudioFormat.RAW_PCM_S16LE = 1):
  Feeds each chunk through VADRingBuffer → Whisper fires when VAD detects
  end of speech. Enables true real-time partial results.
"""
from __future__ import annotations

import asyncio
import io
import logging
from typing import AsyncIterator

import numpy as np
import soundfile as sf
import grpc

# Generated stubs (run `make proto` to create these files)
from app.proto import stt_pb2, stt_pb2_grpc
from app.adapters.vad_processor import VADRingBuffer, load_silero_vad
from app.adapters.ffmpeg_decoder import StreamingDecoder
from app.adapters.whisper_model import ModelHandle, run_transcription
from app.config import Settings

logger = logging.getLogger(__name__)


def _decode_encoded_audio(raw_bytes: bytes, sample_rate: int = 16_000) -> np.ndarray:
    """Decode WebM/OGG/MP3 bytes → float32 16-kHz mono PCM (via soundfile+ffmpeg)."""
    buf = io.BytesIO(raw_bytes)
    audio, sr = sf.read(buf, dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)  # stereo → mono
    if sr != sample_rate:
        # Simple resample using numpy (good enough for Whisper)
        ratio = sample_rate / sr
        n = int(len(audio) * ratio)
        audio = np.interp(
            np.linspace(0, len(audio), n),
            np.arange(len(audio)),
            audio,
        )
    return audio.astype(np.float32)


def _whisper_on_array(
    handle: ModelHandle,
    audio: np.ndarray,
    language: str | None,
    beam_size: int = 5,
) -> stt_pb2.TranscriptResult:
    """Run faster-whisper on a float32 audio array and return a TranscriptResult."""
    segments_iter, info = handle.model.transcribe(
        audio,
        language=language or None,
        beam_size=beam_size,
        vad_filter=False,  # VAD already applied upstream
    )

    segments_out: list[stt_pb2.Segment] = []
    text_parts: list[str] = []
    avg_logprob = 0.0
    count = 0

    for seg in segments_iter:
        text_parts.append(seg.text.strip())
        avg_logprob += seg.avg_logprob
        count += 1
        segments_out.append(
            stt_pb2.Segment(start=seg.start, end=seg.end, text=seg.text.strip())
        )

    confidence = avg_logprob / count if count else 0.0

    return stt_pb2.TranscriptResult(
        text=" ".join(text_parts),
        is_final=True,
        language=info.language,
        confidence=confidence,
        segments=segments_out,
    )


class STTServicer(stt_pb2_grpc.STTServiceServicer):
    """
    gRPC servicer — one instance shared across all connections.
    VADRingBuffer is instantiated per-stream (per TranscribeStream call).
    """

    def __init__(self, model_handle: ModelHandle, settings: Settings) -> None:
        self._model = model_handle
        self._settings = settings
        # Silero VAD model is also a singleton; load once
        self._vad_model, _ = load_silero_vad()

    # ── TranscribeStream ──────────────────────────────────────────────────────

    async def TranscribeStream(
        self,
        request_iterator: AsyncIterator[stt_pb2.AudioChunk],
        context: grpc.aio.ServicerContext,
    ):
        """
        Bidirectional streaming RPC.
        Client sends AudioChunk messages; server yields TranscriptResult messages.
        """
        language: str | None = None
        audio_format: int | None = None
        
        vad: VADRingBuffer | None = None
        decoder: StreamingDecoder | None = None
        
        # Queue for speech segments found by the background reader or the main loop
        speech_queue: asyncio.Queue[np.ndarray] = asyncio.Queue()
        
        async def ffmpeg_reader():
            """Background task to read from FFmpeg and push to VAD."""
            nonlocal vad
            if not decoder or not vad:
                return
            try:
                while True:
                    pcm_bytes = await decoder.read(8192)
                    if not pcm_bytes:  # EOF
                        break
                    speech = vad.push(pcm_bytes)
                    if speech is not None:
                        await speech_queue.put(speech)
            except Exception as e:
                logger.error("Error in ffmpeg_reader: %s", e)

        reader_task: asyncio.Task | None = None

        try:
            async for chunk in request_iterator:
                # 1. Initialize state on first chunk
                if chunk.language and language is None:
                    language = chunk.language
                
                if audio_format is None and chunk.format != 0: # 0 is often default/unset, check proto
                    # Actually let's just check the explicit format
                    audio_format = chunk.format

                # Default to ENCODED if still not set
                if audio_format is None:
                    audio_format = stt_pb2.AudioFormat.Value("ENCODED")

                # 2. Setup VAD and Decoder if needed
                if vad is None:
                    vad = VADRingBuffer(
                        model=self._vad_model,
                        threshold=self._settings.vad_threshold,
                        sample_rate=chunk.sample_rate or 16_000,
                    )
                
                if audio_format == stt_pb2.AudioFormat.Value("ENCODED") and decoder is None:
                    decoder = StreamingDecoder(sample_rate=chunk.sample_rate or 16_000)
                    await decoder.start()
                    reader_task = asyncio.create_task(ffmpeg_reader())

                # 3. Process data
                if audio_format == stt_pb2.AudioFormat.Value("RAW_PCM_S16LE"):
                    if chunk.data:
                        speech = vad.push(chunk.data)
                        if speech is not None:
                            await speech_queue.put(speech)
                else:
                    # ENCODED path
                    if chunk.data:
                        await decoder.push(chunk.data)

                # 4. Yield any ready results from the queue
                while not speech_queue.empty():
                    speech = await speech_queue.get()
                    logger.info("VAD: speech segment ready (%.2fs)", len(speech) / 16_000)
                    result = _whisper_on_array(self._model, speech, language)
                    yield result

                if chunk.end_of_stream:
                    break

            # ── End of Stream ──────────────────────────────────────────────────
            
            # Close decoder and wait for reader to finish
            if decoder:
                await decoder.stop()
            if reader_task:
                await reader_task

            # Final flush of VAD
            if vad:
                speech = vad.flush()
                if speech is not None:
                    logger.info("VAD: final speech segment ready (%.2fs)", len(speech) / 16_000)
                    result = _whisper_on_array(self._model, speech, language)
                    yield result

        except Exception as e:
            logger.exception("Error in TranscribeStream: %s", e)
            await context.abort(grpc.StatusCode.INTERNAL, str(e))
        finally:
            if decoder:
                await decoder.stop()
            if reader_task and not reader_task.done():
                reader_task.cancel()

    # ── Health ────────────────────────────────────────────────────────────────

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
