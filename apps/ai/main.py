"""main.py — Zeno AI service entry point."""
from __future__ import annotations

import uvicorn

from api.app import create_app
from core.config import get_settings
from core.logging import configure_logging

app = create_app()

if __name__ == "__main__":
    settings = get_settings()
    configure_logging(settings.log_level)
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
        log_config=None,  # Use our structured logger
    )
