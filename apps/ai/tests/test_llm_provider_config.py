from __future__ import annotations

import pytest

from core.config import Settings
from core.llm import get_llm


def test_openrouter_free_model_defaults_to_nemotron() -> None:
    settings = Settings(_env_file=None)
    assert settings.openrouter_model == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert settings.openrouter_base_url == "https://openrouter.ai/api/v1"


def test_openrouter_free_model_is_limited_to_development() -> None:
    settings = Settings(
        _env_file=None,
        LLM_PROVIDER="openrouter",
        OPENROUTER_API_KEY="test-key",
        ENVIRONMENT="production",
    )

    with pytest.raises(ValueError, match="restricted to development/demo use"):
        get_llm(settings)
