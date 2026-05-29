"""
FastAPI HTTP router — delivery layer.
Depends only on TranscriptionService (injected via FastAPI DI).
No business logic lives here.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.domain.schemas import ErrorResponse, TranscribeRequest, TranscribeResponse
from app.services.transcription_service import TranscriptionService
from app.dependencies import get_transcription_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcribe", tags=["STT"])


@router.post(
    "",
    response_model=TranscribeResponse,
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ErrorResponse},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ErrorResponse},
    },
    summary="Transcribe audio file stored in MinIO",
    description=(
        "Downloads the audio file from MinIO using `file_path` + `bucket_name`, "
        "runs Silero VAD to strip silence, then transcribes with faster-whisper. "
        "Returns the full text plus per-segment timing data."
    ),
)
async def transcribe(
    request: TranscribeRequest,
    service: TranscriptionService = Depends(get_transcription_service),
) -> TranscribeResponse:
    logger.info(
        "POST /transcribe: file_path=%s bucket=%s lang=%s",
        request.file_path,
        request.bucket_name,
        request.language,
    )

    try:
        result = service.transcribe(request)
        return result
    except Exception as exc:
        logger.exception("Transcription failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {exc}",
        )


@router.get(
    "/health",
    summary="Health check",
    tags=["Health"],
    status_code=status.HTTP_200_OK,
)
async def health() -> dict:
    return {"status": "ok"}
