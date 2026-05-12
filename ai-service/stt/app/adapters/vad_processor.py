"""
VAD Ring Buffer — infrastructure layer.

Wraps Silero VAD to detect speech boundaries in a chunk-by-chunk audio stream.
Designed for raw PCM 16-kHz mono int16 bytes streamed from Go via gRPC.

For ENCODED formats (WebM/OGG) the caller must decode to PCM first.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch

logger = logging.getLogger(__name__)

# Silero VAD requirements: 30 ms chunks at 16 kHz = 480 samples
_SAMPLE_RATE = 16_000
_CHUNK_MS = 30
_SAMPLES_PER_CHUNK = _SAMPLE_RATE * _CHUNK_MS // 1000  # 480


def load_silero_vad() -> tuple:
    """Load Silero VAD model from torch hub (cached after first call)."""
    logger.info("Loading Silero VAD …")
    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
        trust_repo=True,
    )
    logger.info("Silero VAD loaded.")
    return model, utils


class VADRingBuffer:
    """
    Stateful VAD processor for a single gRPC stream session.

    Usage (one instance per client stream):
        vad = VADRingBuffer(model, threshold=0.5)
        for raw_pcm_bytes in stream:
            speech = vad.push(raw_pcm_bytes)
            if speech is not None:
                transcribe(speech)          # float32 numpy array
        speech = vad.flush()                # end-of-stream flush
    """

    def __init__(
        self,
        model,                          # Silero VAD model
        threshold: float = 0.5,
        silence_duration_ms: int = 500, # silence needed to end a speech segment
        min_speech_ms: int = 200,       # discard shorter segments (noise)
        sample_rate: int = _SAMPLE_RATE,
    ) -> None:
        self._model = model
        self._threshold = threshold
        self._sample_rate = sample_rate

        # frames = integer number of 30ms chunks
        self._silence_limit = max(1, silence_duration_ms // _CHUNK_MS)
        self._min_speech_frames = max(1, min_speech_ms // _CHUNK_MS)

        self._reset()

    # ── Public API ────────────────────────────────────────────────────────────

    def push(self, raw_bytes: bytes) -> Optional[np.ndarray]:
        """
        Feed *raw_bytes* (int16 LE PCM).
        Returns float32 numpy array of the speech segment when VAD detects
        end-of-speech; returns None while speech is accumulating.
        """
        self._leftover += raw_bytes
        result: Optional[np.ndarray] = None

        chunk_bytes = _SAMPLES_PER_CHUNK * 2  # int16 = 2 bytes/sample

        while len(self._leftover) >= chunk_bytes:
            chunk = self._leftover[:chunk_bytes]
            self._leftover = self._leftover[chunk_bytes:]

            prob = self._vad_prob(chunk)

            if prob >= self._threshold:
                self._is_speaking = True
                self._silence_count = 0
                self._speech_count += 1
                self._speech_chunks.append(chunk)
            elif self._is_speaking:
                self._silence_count += 1
                self._speech_chunks.append(chunk)  # keep trailing silence

                if self._silence_count >= self._silence_limit:
                    result = self._finalise()  # may be None if too short
                    # stop processing further in this call; leftover stays
                    break

        return result

    def flush(self) -> Optional[np.ndarray]:
        """Force-finalise remaining speech on end-of-stream signal."""
        if self._is_speaking:
            return self._finalise(force=True)
        self._reset()
        return None

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _vad_prob(self, chunk: bytes) -> float:
        pcm = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
        tensor = torch.from_numpy(pcm)
        with torch.no_grad():
            return float(self._model(tensor, self._sample_rate).item())

    def _finalise(self, force: bool = False) -> Optional[np.ndarray]:
        """Convert accumulated chunks to float32 array; reset state."""
        if not force and self._speech_count < self._min_speech_frames:
            logger.debug("VAD: discarded short segment (%d frames)", self._speech_count)
            self._reset()
            return None

        audio_bytes = b"".join(self._speech_chunks)
        pcm = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        logger.debug(
            "VAD: speech segment ready (%.2f s, %d speech frames)",
            len(pcm) / self._sample_rate,
            self._speech_count,
        )
        self._reset()
        return pcm

    def _reset(self) -> None:
        self._model.reset_states()
        self._speech_chunks: list[bytes] = []
        self._silence_count = 0
        self._speech_count = 0
        self._is_speaking = False
        self._leftover = b""
