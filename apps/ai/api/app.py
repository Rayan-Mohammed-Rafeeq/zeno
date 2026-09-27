"""api/app.py — Zeno AI FastAPI application factory."""
from __future__ import annotations

import hmac
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.logging import configure_logging, set_request_id

logger = logging.getLogger(__name__)

# ─── Shared application state ────────────────────────────────────────────────

_shared_llm = None


def get_shared_llm():
    return _shared_llm


# ─── Lifespan ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _shared_llm
    settings = get_settings()
    configure_logging(settings.log_level)

    try:
        from core.llm import get_llm
        _shared_llm = get_llm(settings)
        logger.info(
            "LLM provider initialised",
            extra={"provider": settings.llm_provider},
        )
    except Exception as exc:
        logger.error("LLM initialisation failed: %s", exc)
        _shared_llm = None

    logger.info(
        "Zeno AI service started",
        extra={"port": settings.api_port, "environment": settings.environment},
    )
    yield
    logger.info("Zeno AI service shutting down")


# ─── API key dependency ───────────────────────────────────────────────────────


async def verify_api_key(request: Request) -> None:
    settings = get_settings()
    if not settings.ai_service_api_key:
        return  # Auth disabled in development

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = auth_header.removeprefix("Bearer ")
    if not hmac.compare_digest(token, settings.ai_service_api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )


# ─── App factory ─────────────────────────────────────────────────────────────


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Zeno AI — Refill Resolution Intelligence",
        description=(
            "Interprets prescription refill blockers, determines next operational actions, "
            "and prepares structured recommendations for human review."
        ),
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )

    # CORS — only allow the Spring Boot origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:8080"],
        allow_methods=["POST", "GET"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        allow_credentials=False,
    )

    # Request ID middleware
    @app.middleware("http")
    async def inject_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        set_request_id(request_id)
        start = time.monotonic()
        response: Response = await call_next(request)
        duration_ms = int((time.monotonic() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "HTTP request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "request_id": request_id,
            },
        )
        return response

    # Body size limit — 512 KiB
    _MAX_BODY = 512 * 1024

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_BODY:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body too large"},
            )
        return await call_next(request)

    # Include routers
    from api.routes import refill_resolution, health
    app.include_router(health.router)
    app.include_router(refill_resolution.router)

    return app
