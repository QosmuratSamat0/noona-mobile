#!/usr/bin/env python3
"""
Entry point for running the STT service directly:
  python main.py
or via uvicorn:
  uvicorn app.main:app --host 0.0.0.0 --port 8001
"""
import uvicorn

from app.config import get_settings
from app.main import create_app

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        # Use 1 worker — Whisper model is NOT thread-safe across processes.
        # Scale horizontally by running multiple containers instead.
        workers=1,
        reload=False,
    )
