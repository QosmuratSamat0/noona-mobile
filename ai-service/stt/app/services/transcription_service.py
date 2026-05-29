"""
TranscriptionService — application / use-case layer.

Orchestrates the full pipeline:
  1. Download audio from MinIO → local /tmp file
  2. Run Silero VAD + Whisper transcription
  3. Clean up the local temp file (always, in finally block)

This layer depends only on interfaces (adapters), never on HTTP/FastAPI.
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from app.adapters.minio_adapter import MinioAdapter
from app.adapters.whisper_model import ModelHandle, run_transcription
from app.config import Settings
from app.domain.schemas import TranscribeRequest, TranscribeResponse, TranscriptSegment

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    Core use-case: takes a TranscribeRequest, returns a TranscribeResponse.
    All I/O is handled by injected adapters.
    """

    def __init__(
        self,
        model_handle: ModelHandle,
        minio: MinioAdapter,
        settings: Settings,
    ) -> None:
        self._model = model_handle
        self._minio = minio
        self._settings = settings

    def transcribe(self, request: TranscribeRequest) -> TranscribeResponse:
        """
        Full transcription pipeline.

        Contract:
          - Always deletes the local temp file, even on error (finally).
          - Never deletes the MinIO object (caller's responsibility).
          - Raises on any unrecoverable error so the HTTP layer can return 500.
        """
        bucket = request.bucket_name or self._settings.minio_default_bucket
        object_key = request.file_path

        tmp_dir = Path(self._settings.tmp_dir)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(object_key).suffix or ".webm"
        local_path = str(tmp_dir / f"{uuid.uuid4()}{suffix}")

        logger.info(
            "Starting transcription: bucket=%s key=%s local=%s",
            bucket,
            object_key,
            local_path,
        )

        try:
            self._minio.download(bucket, object_key, local_path)
            logger.info("Downloaded audio to %s", local_path)

            segments_iter, info = run_transcription(
                handle=self._model,
                audio_path=local_path,
                language=request.language,
                beam_size=request.beam_size,
                vad_filter=self._settings.vad_enabled,
                vad_threshold=self._settings.vad_threshold,
            )

            segments: list[TranscriptSegment] = []
            text_parts: list[str] = []

            for seg in segments_iter:
                segments.append(
                    TranscriptSegment(
                        id=seg.id,
                        start=round(seg.start, 3),
                        end=round(seg.end, 3),
                        text=seg.text.strip(),
                        avg_logprob=round(seg.avg_logprob, 4),
                        no_speech_prob=round(seg.no_speech_prob, 4),
                    )
                )
                text_parts.append(seg.text.strip())

            full_text = " ".join(text_parts)
            logger.info(
                "Transcription complete: lang=%s duration=%.1fs segments=%d chars=%d",
                info.language,
                info.duration,
                len(segments),
                len(full_text),
            )

            return TranscribeResponse(
                text=full_text,
                language=info.language,
                duration_seconds=round(info.duration, 2),
                segments=segments,
            )

        finally:
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    logger.debug("Removed temp file: %s", local_path)
                except OSError as exc:
                    logger.warning("Failed to remove temp file %s: %s", local_path, exc)
