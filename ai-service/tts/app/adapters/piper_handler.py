"""
Piper TTS handler — infrastructure layer.
Loads the model once (Singleton) and provides streaming synthesis.
"""

from __future__ import annotations

import logging
import os
import json
import inspect
from dataclasses import dataclass
from typing import Any, Iterator

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
        raise FileNotFoundError(f"Piper model not found: {model_path}")

    logger.info(
        "Loading Piper model '%s' (cuda=%s)", settings.piper_model, settings.use_cuda
    )

    voice = PiperVoice.load(model_path, config_path=config_path, use_cuda=settings.use_cuda)
    sample_rate = _resolve_sample_rate(voice, config_path)
    _patch_voice_sample_rate(voice, sample_rate)

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
    config = getattr(voice, "config", None)
    if isinstance(config, dict):
        candidates.extend(
            [
                config.get("sample_rate"),
                (config.get("audio") or {}).get("sample_rate")
                if isinstance(config.get("audio"), dict)
                else None,
            ]
        )

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


def _patch_voice_sample_rate(voice: PiperVoice, sample_rate: int) -> None:
    """
    Some Piper versions read sample_rate again during synthesis from voice.config.
    Keep our resolved value there as well so synthesize_stream_raw never sees it
    as missing.
    """
    config = getattr(voice, "config", None)
    if config is None:
        return

    _set_sample_rate(config, sample_rate)
    _set_sample_rate(getattr(config, "audio", None), sample_rate)
    _set_sample_rate(getattr(config, "synthesis", None), sample_rate)

    if isinstance(config, dict):
        _set_sample_rate(config.setdefault("audio", {}), sample_rate)
        _set_sample_rate(config.setdefault("synthesis", {}), sample_rate)


def _set_sample_rate(target: Any, sample_rate: int) -> None:
    if target is None:
        return
    if isinstance(target, dict):
        target["sample_rate"] = sample_rate
        return
    try:
        setattr(target, "sample_rate", sample_rate)
    except Exception:
        try:
            object.__setattr__(target, "sample_rate", sample_rate)
        except Exception:
            pass


def synthesize_stream(handle: ModelHandle, text: str) -> Iterator[bytes]:
    """
    Generate raw PCM audio chunks from text.
    Supports both Piper APIs:
    - older versions expose synthesize_stream_raw(text) -> bytes
    - newer versions expose synthesize(text) -> AudioChunk with audio_int16_bytes
    """
    raw_stream = getattr(handle.voice, "synthesize_stream_raw", None)
    if callable(raw_stream):
        kwargs = _supported_kwargs(raw_stream, {"sample_rate": handle.sample_rate})
        try:
            yield from raw_stream(text, **kwargs)
            return
        except Exception as exc:
            if "sample" not in str(exc).lower():
                raise
            logger.warning(
                "Piper raw stream failed with sample rate error; trying synthesize API",
                exc_info=True,
            )

    synthesis = getattr(getattr(handle.voice, "config", None), "synthesis", None)
    synthesize = getattr(handle.voice, "synthesize", None)
    if not callable(synthesize):
        raise RuntimeError("Piper voice has no supported synthesize method")

    kwargs = _supported_kwargs(synthesize, {"sample_rate": handle.sample_rate})
    try:
        stream = synthesize(text, synthesis, **kwargs) if synthesis is not None else synthesize(text, **kwargs)
    except TypeError:
        stream = synthesize(text, **kwargs)

    for chunk in stream:
        if isinstance(chunk, bytes):
            yield chunk
            continue
        chunk_sample_rate = getattr(chunk, "sample_rate", None)
        if chunk_sample_rate and chunk_sample_rate != handle.sample_rate:
            logger.warning(
                "Piper chunk sample rate differs from model handle (chunk=%s, handle=%s)",
                chunk_sample_rate,
                handle.sample_rate,
            )
        audio_data = getattr(chunk, "audio_int16_bytes", chunk)
        if not isinstance(audio_data, bytes):
            logger.error("Получен неподдерживаемый тип чанка: %s", type(audio_data))
            raise TypeError(f"Expected bytes, got {type(audio_data)}")
        yield audio_data


def _supported_kwargs(func: Any, candidates: dict[str, Any]) -> dict[str, Any]:
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return {}
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in signature.parameters.values()):
        return candidates
    return {name: value for name, value in candidates.items() if name in signature.parameters}
