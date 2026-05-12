"""
WhisperModel service — infrastructure / model layer.
Loads faster-whisper once at startup (Singleton) and exposes
a single `transcribe()` method consumed by the TranscriptionService.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterator, Tuple

import torch
from faster_whisper import WhisperModel
from faster_whisper.transcribe import Segment, TranscriptionInfo

from app.config import Settings

logger = logging.getLogger(__name__)


def _resolve_device(requested: str) -> str:
    """Map 'auto' → 'cuda' if available, otherwise 'cpu'."""
    if requested == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return requested


def _resolve_compute_type(requested: str, device: str) -> str:
    """
    Map 'auto' to the best compute type for the resolved device.
      - GPU  → float16  (fast, accurate, supported by all modern NVIDIA cards)
      - CPU  → int8     (2-3× faster than float32, near-identical accuracy)
    """
    if requested == "auto":
        return "float16" if device == "cuda" else "int8"
    return requested


@dataclass(frozen=True)
class ModelHandle:
    """Immutable container returned after model initialisation."""

    model: WhisperModel
    device: str
    compute_type: str
    model_size: str


def load_model(settings: Settings) -> ModelHandle:
    """
    Load faster-whisper from Hugging Face / local cache.
    Called once during application lifespan startup.
    """
    device = _resolve_device(settings.whisper_device)
    compute_type = _resolve_compute_type(settings.whisper_compute_type, device)

    logger.info(
        "Loading Whisper model '%s' on device='%s' compute_type='%s' cpu_threads=%d",
        settings.whisper_model_size,
        device,
        compute_type,
        settings.whisper_cpu_threads,
    )

    model = WhisperModel(
        settings.whisper_model_size,
        device=device,
        compute_type=compute_type,
        cpu_threads=settings.whisper_cpu_threads,
        num_workers=settings.whisper_num_workers,
    )

    logger.info("Whisper model loaded successfully.")
    return ModelHandle(
        model=model,
        device=device,
        compute_type=compute_type,
        model_size=settings.whisper_model_size,
    )


def run_transcription(
    handle: ModelHandle,
    audio_path: str,
    language: str | None,
    beam_size: int,
    vad_filter: bool,
    vad_threshold: float,
) -> Tuple[Iterator[Segment], TranscriptionInfo]:
    """
    Thin wrapper around WhisperModel.transcribe().
    Returns the raw (segments_iter, info) tuple for the service layer to process.
    """
    return handle.model.transcribe(
        audio_path,
        language=language,
        beam_size=beam_size,
        # ── VAD integration ──────────────────────────────────────────────────
        # Silero VAD runs inside faster-whisper; filters silent chunks before
        # passing audio to the Whisper encoder — critical for CPU performance.
        vad_filter=vad_filter,
        vad_parameters={
            "threshold": vad_threshold,
            # Min speech duration in ms to be kept
            "min_speech_duration_ms": 250,
            # Pad kept speech chunks by this many ms on each side
            "speech_pad_ms": 400,
        },
        # Always request word-level timestamps so callers can build subtitles
        word_timestamps=False,
    )
