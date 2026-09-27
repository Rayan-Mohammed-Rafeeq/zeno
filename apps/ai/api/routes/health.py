"""api/routes/health.py — Health check endpoint."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from api.app import get_shared_llm
from core.config import get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    llm_provider: str
    llm_ready: bool
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    llm = get_shared_llm()
    return HealthResponse(
        status="ok",
        service="zeno-ai",
        version="0.1.0",
        llm_provider=settings.llm_provider,
        llm_ready=llm is not None,
        environment=settings.environment,
    )
