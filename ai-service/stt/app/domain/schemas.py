"""
Domain-level data contracts for the STT service.
No framework dependencies — pure Pydantic models.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TranscribeRequest(BaseModel):
    """Request payload for POST /transcribe."""

    file_path: str = Field(
        ...,
        description="Object key inside MinIO (e.g. 'audio/uuid.webm')",
        examples=["audio/recordings/3f2a-b1c2.webm"],
    )
    bucket_name: str = Field(
        default="voice-input",
        description="MinIO bucket name (defaults to env-configured value).",
    )
    language: str | None = Field(
        default=None,
        description="ISO-639-1 language code, e.g. 'ru'. None = auto-detect.",
        examples=["ru", "en", "kk"],
    )
    beam_size: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Beam size for Whisper decoding. Higher = more accurate, slower.",
    )


class TranscriptSegment(BaseModel):
    """Single timed segment from Whisper output."""

    id: int
    start: float = Field(..., description="Segment start time in seconds.")
    end: float = Field(..., description="Segment end time in seconds.")
    text: str
    avg_logprob: float
    no_speech_prob: float


class TranscribeResponse(BaseModel):
    """Full transcription result returned to the caller."""

    text: str = Field(..., description="Full concatenated transcript.")
    language: str = Field(..., description="Detected or requested language.")
    duration_seconds: float = Field(..., description="Audio duration in seconds.")
    segments: list[TranscriptSegment] = Field(
        default_factory=list,
        description="Per-segment results with timestamps (useful for subtitles).",
    )


class ErrorResponse(BaseModel):
    detail: str
