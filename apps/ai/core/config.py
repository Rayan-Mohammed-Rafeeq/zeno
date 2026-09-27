"""core/config.py — Zeno AI service configuration.

All values come from environment variables or a .env file.
Never hard-code secrets here.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal[
    "mock", "openrouter", "anthropic", "openai", "google", "bedrock", "azure", "ollama"
]


class Settings(BaseSettings):
    """Central settings for the Zeno AI service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    # ── LLM ──────────────────────────────────────────────────────────────────
    llm_provider: LLMProvider = Field(default="mock", validation_alias="LLM_PROVIDER")

    anthropic_api_key: str | None = Field(default=None)
    anthropic_model: str = Field(
        default="claude-3-5-sonnet-20241022", validation_alias="ANTHROPIC_MODEL"
    )

    openai_api_key: str | None = Field(default=None)
    openai_model: str = Field(default="gpt-4o", validation_alias="OPENAI_MODEL")

    openrouter_api_key: str | None = Field(default=None, validation_alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(
        default="nvidia/nemotron-3-ultra-550b-a55b:free",
        validation_alias="OPENROUTER_MODEL",
    )
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        validation_alias="OPENROUTER_BASE_URL",
    )

    google_api_key: str | None = Field(default=None)
    google_model: str = Field(default="gemini-1.5-pro", validation_alias="GOOGLE_MODEL")

    max_tokens: int = Field(default=2048, ge=256, le=8192)

    llm_request_timeout_seconds: float = Field(
        default=60.0,
        ge=5.0,
        validation_alias="LLM_REQUEST_TIMEOUT_SECONDS",
    )

    # ── Budget ────────────────────────────────────────────────────────────────
    pack_default_budget_usd: float | None = Field(
        default=0.05,
        validation_alias="PACK_DEFAULT_BUDGET_USD",
        description="Max USD per single refill analysis. None = no limit.",
    )

    @field_validator("pack_default_budget_usd", mode="before")
    @classmethod
    def _blank_is_none(cls, v: object) -> object:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    # ── Service auth ──────────────────────────────────────────────────────────
    ai_service_api_key: str | None = Field(
        default=None,
        validation_alias="AI_SERVICE_API_KEY",
        description="Shared secret for service-to-service calls from Spring Boot.",
    )

    # ── Server ────────────────────────────────────────────────────────────────
    api_host: str = Field(default="0.0.0.0", validation_alias="API_HOST")  # noqa: S104
    api_port: int = Field(default=8001, ge=1, le=65535, validation_alias="API_PORT")

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO", validation_alias="LOG_LEVEL"
    )

    # ── Environment ───────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = Field(
        default="development", validation_alias="ENVIRONMENT"
    )

    # ── Graph execution ───────────────────────────────────────────────────────
    max_graph_steps: int = Field(
        default=12,
        ge=4,
        le=30,
        description="Hard cap on total LangGraph steps per refill analysis.",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings singleton."""
    return Settings()  # type: ignore[call-arg]
