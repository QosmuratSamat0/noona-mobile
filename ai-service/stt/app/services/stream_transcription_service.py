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

import io
import logging
from typing import AsyncIterator

import numpy as np
import soundfile as sf
import grpc

# Generated stubs (run `make proto` to create these files)
from app.proto import stt_pb2, stt_pb2_grpc
from app.adapters.vad_processor import VADRingBuffer, load_silero_vad
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
        audio_format = stt_pb2.AudioFormat.Value("ENCODED")

        # For ENCODED: accumulate all bytes then process
        encoded_buffer = bytearray()

        # For RAW_PCM: stateful VAD ring buffer
        vad: VADRingBuffer | None = None

        async for chunk in request_iterator:
            # Latch language and format from first chunk that specifies them
            if chunk.language:
                language = chunk.language
            if chunk.format == stt_pb2.AudioFormat.Value("RAW_PCM_S16LE"):
                audio_format = stt_pb2.AudioFormat.Value("RAW_PCM_S16LE")
                if vad is None:
                    vad = VADRingBuffer(
                        model=self._vad_model,
                        threshold=self._settings.vad_threshold,
                        sample_rate=chunk.sample_rate or 16_000,
                    )

            if audio_format == stt_pb2.AudioFormat.Value("RAW_PCM_S16LE"):
                # ── Real-time PCM path ────────────────────────────────────
                if chunk.end_of_stream:
                    speech = vad.flush() if vad else None
                else:
                    speech = vad.push(chunk.data) if vad else None

                if speech is not None:
                    logger.info("VAD: speech segment ready (%.2fs)", len(speech) / 16_000)
                    result = _whisper_on_array(self._model, speech, language)
                    yield result

            else:
                # ── Encoded file path ─────────────────────────────────────
                if chunk.data:
                    encoded_buffer.extend(chunk.data)

                if chunk.end_of_stream and encoded_buffer:
                    logger.info("ENCODED: decoding %d bytes", len(encoded_buffer))
                    audio = _decode_encoded_audio(bytes(encoded_buffer))
                    result = _whisper_on_array(self._model, audio, language)
                    yield result
                    encoded_buffer.clear()

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
