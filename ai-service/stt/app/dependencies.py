"""
Dependency injection container.
FastAPI calls these functions to resolve dependencies on each request.
The model and MinIO adapter are singletons created during lifespan startup
and stored in app.state.
"""
from __future__ import annotations

from fastapi import Request

from app.services.transcription_service import TranscriptionService


def get_transcription_service(request: Request) -> TranscriptionService:
    """
    Retrieve the pre-built TranscriptionService from app state.
    Raises a clear error if called before lifespan startup (should never happen).
    """
    service: TranscriptionService | None = getattr(
        request.app.state, "transcription_service", None
    )
    if service is None:
        raise RuntimeError(
            "TranscriptionService not initialised. "
            "Ensure the FastAPI lifespan context manager ran successfully."
        )
    return service
