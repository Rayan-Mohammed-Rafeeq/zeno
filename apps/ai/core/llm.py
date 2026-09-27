"""core/llm.py — Provider-agnostic LLM factory for Zeno AI.

Adapted from langgraph-agent-stack/core/llm.py — stripped to the providers
Zeno actually uses. Add new providers here when needed.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.language_models import BaseChatModel

if TYPE_CHECKING:
    from core.config import Settings

logger = logging.getLogger(__name__)

_SDK_MAX_RETRIES = 0  # Tenacity handles retries at the graph level


def get_llm(settings: "Settings") -> BaseChatModel:
    """Instantiate a LangChain chat model from Zeno AI settings.

    The ``mock`` provider requires no API key and is the default for development.
    """
    provider = settings.llm_provider

    match provider:
        case "mock":
            from core.mock_llm import MockProviderChatModel
            return MockProviderChatModel()

        case "openrouter":
            if (
                settings.openrouter_model.endswith(":free")
                and settings.environment != "development"
            ):
                raise ValueError(
                    "OpenRouter free models are restricted to development/demo use. "
                    "Do not send confidential or personal refill data to the free endpoint."
                )
            try:
                from langchain_openai import ChatOpenAI
            except ImportError as exc:
                raise ImportError(
                    "Install the OpenAI-compatible provider extra: pip install '.[openai]'"
                ) from exc
            if not settings.openrouter_api_key:
                raise ValueError(
                    "OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter"
                )
            return ChatOpenAI(
                model=settings.openrouter_model,
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
                max_tokens=settings.max_tokens,
                max_retries=_SDK_MAX_RETRIES,
                request_timeout=settings.llm_request_timeout_seconds,
                default_headers={"X-OpenRouter-Title": "Zeno Refill Resolution"},
            )

        case "anthropic":
            try:
                from langchain_anthropic import ChatAnthropic
            except ImportError as exc:
                raise ImportError(
                    "Install with: pip install langchain-anthropic"
                ) from exc
            if not settings.anthropic_api_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic"
                )
            return ChatAnthropic(
                model=settings.anthropic_model,
                api_key=settings.anthropic_api_key,
                max_tokens=settings.max_tokens,
                max_retries=_SDK_MAX_RETRIES,
                default_request_timeout=settings.llm_request_timeout_seconds,
            )

        case "openai":
            try:
                from langchain_openai import ChatOpenAI
            except ImportError as exc:
                raise ImportError(
                    "Install with: pip install langchain-openai"
                ) from exc
            if not settings.openai_api_key:
                raise ValueError(
                    "OPENAI_API_KEY is required when LLM_PROVIDER=openai"
                )
            return ChatOpenAI(
                model=settings.openai_model,
                api_key=settings.openai_api_key,
                max_tokens=settings.max_tokens,
                max_retries=_SDK_MAX_RETRIES,
                request_timeout=settings.llm_request_timeout_seconds,
            )

        case "google":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
            except ImportError as exc:
                raise ImportError(
                    "Install with: pip install langchain-google-genai"
                ) from exc
            if not settings.google_api_key:
                raise ValueError(
                    "GOOGLE_API_KEY is required when LLM_PROVIDER=google"
                )
            return ChatGoogleGenerativeAI(
                model=settings.google_model,
                google_api_key=settings.google_api_key,
                max_output_tokens=settings.max_tokens,
                max_retries=_SDK_MAX_RETRIES,
                timeout=settings.llm_request_timeout_seconds,
            )

        case _:
            raise ValueError(
                f"Unsupported LLM_PROVIDER: {provider!r}. "
                "Supported: mock, openrouter, anthropic, openai, google"
            )
