"""
Piper TTS handler — infrastructure layer.
Loads the model once (Singleton) and provides streaming synthesis.
"""

from __future__ import annotations

import logging
import os
import json
from dataclasses import dataclass
from typing import Iterator

from app.config import Settings
from piper import PiperVoice

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelHandle:
    """Immutable container for the loaded Piper model."""

    voice: PiperVoice
    model_name: str
    sample_rate: int


def load_model(settings: Settings) -> ModelHandle:
    """
    Load Piper model from the models directory.
    Called once during application lifespan startup.
    """
    model_path = os.path.join(settings.models_dir, settings.piper_model)
    config_path = f"{model_path}.json"

    if not os.path.exists(model_path):
        logger.error(f"Piper model file not found at {model_path}")
        # We raise here to stop the service if the core model is missing
        raise FileNotFoundError(f"Piper model not found: {model_path}")

    logger.info(
        "Loading Piper model '%s' (cuda=%s)", settings.piper_model, settings.use_cuda
    )

    voice = PiperVoice.load(model_path, config_path=config_path, use_cuda=settings.use_cuda)
    sample_rate = _resolve_sample_rate(voice, config_path)

    logger.info("Piper model loaded successfully (sample_rate=%s).", sample_rate)
    return ModelHandle(voice=voice, model_name=settings.piper_model, sample_rate=sample_rate)


def _resolve_sample_rate(voice: PiperVoice, config_path: str) -> int:
    """
    Piper package versions expose sample rate differently. Prefer the loaded
    voice object, then fall back to the model JSON, then a safe Piper default.
    """
    candidates = [
        getattr(getattr(voice, "config", None), "sample_rate", None),
        getattr(getattr(getattr(voice, "config", None), "audio", None), "sample_rate", None),
    ]

    for value in candidates:
        if isinstance(value, int) and value > 0:
            return value

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        value = data.get("audio", {}).get("sample_rate")
        if isinstance(value, int) and value > 0:
            return value
    except Exception:
        logger.warning("Could not read Piper sample rate from %s", config_path, exc_info=True)

    logger.warning("Piper sample rate missing; falling back to 22050 Hz")
    return 22050


def synthesize_stream(handle: ModelHandle, text: str) -> Iterator[bytes]:
    """
    Generate raw PCM audio chunks from text.
    Uses synthesize_stream_raw which returns an iterator of raw 16-bit PCM bytes,
    matching the wave file configured in the servicer (1ch, 16-bit, model sample rate).
    """
    return handle.voice.synthesize_stream_raw(text)
