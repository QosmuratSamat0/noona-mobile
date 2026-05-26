#!/usr/bin/env python3
import uvicorn
from app.config import get_settings
from app.main import app

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        workers=1,
        reload=False,
    )
