"""core/mock_llm.py — Schema-aware mock LLM for Zeno AI.

Adapted from langgraph-agent-stack/core/mock_llm.py.
Produces valid JSON matching any Pydantic output schema without any API key.
Used in development, CI, and all unit tests.
"""
from __future__ import annotations

import json
import types
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date, datetime
from enum import Enum
from typing import Any, Union, get_args, get_origin

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import BaseModel
from pydantic_core import PydanticUndefined

MOCK_MODEL_ID = "mock-provider"

_mock_output_schema: ContextVar[type[BaseModel] | None] = ContextVar(
    "mock_output_schema", default=None
)


@contextmanager
def mock_output_schema_context(schema: type[BaseModel]) -> Iterator[None]:
    """Tell the mock LLM to emit JSON valid for ``schema`` on the next invoke."""
    token = _mock_output_schema.set(schema)
    try:
        yield
    finally:
        _mock_output_schema.reset(token)


def _unwrap_optional(annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin is Union or origin is types.UnionType:
        non_none = [arg for arg in get_args(annotation) if arg is not type(None)]
        if len(non_none) == 1:
            return non_none[0]
    return annotation


def _fake_scalar(field_name: str, annotation: Any) -> Any:
    """Generate a deterministic minimal value for a Pydantic field."""
    annotation = _unwrap_optional(annotation)

    if annotation is str:
        # Return domain-meaningful values for Zeno fields
        _zeno_str_defaults: dict[str, str] = {
            "action_type": "REQUEST_PROVIDER_REVIEW",
            "blocker": "NO_REFILLS",
            "safety_class": "MEDIUM_RISK_CONFIRMATION",
            "urgency": "HIGH",
            "assigned_role": "PROVIDER",
            "next_state": "AWAITING_PROVIDER",
            "current_state": "BLOCKED",
        }
        return _zeno_str_defaults.get(field_name, f"Mock {field_name.replace('_', ' ')}")
    if annotation is int:
        return 1
    if annotation is float:
        return 0.85 if "confidence" in field_name else 0.5
    if annotation is bool:
        return True if "requires_human_approval" in field_name else False
    if annotation is date:
        return date(2026, 1, 1)
    if annotation is datetime:
        return datetime(2026, 1, 1, 0, 0, 0)
    if isinstance(annotation, type) and issubclass(annotation, Enum):
        return next(iter(annotation))
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return generate_mock_payload(annotation)
    origin = get_origin(annotation)
    if origin in (list, Sequence):
        args = get_args(annotation)
        inner = _unwrap_optional(args[0]) if args else str
        if inner is str:
            return [f"Mock {field_name} item"]
        if isinstance(inner, type) and issubclass(inner, BaseModel):
            return [generate_mock_payload(inner)]
        return [f"Mock {field_name} item"]
    if origin in (dict, Mapping):
        return {"mock_key": "mock_value"}
    return f"Mock {field_name}"


def generate_mock_payload(model: type[BaseModel]) -> dict[str, Any]:
    """Build a minimal JSON-serialisable dict that validates against ``model``."""
    payload: dict[str, Any] = {}
    for name, field in model.model_fields.items():
        if field.is_required():
            payload[name] = _fake_scalar(name, field.annotation)
        elif field.default is not PydanticUndefined:
            payload[name] = field.default
        elif field.default_factory is not None:
            payload[name] = field.default_factory()  # type: ignore[misc]
        else:
            payload[name] = _fake_scalar(name, field.annotation)
    return model.model_validate(payload).model_dump(mode="json")


class MockProviderChatModel(BaseChatModel):
    """Deterministic mock chat model. Returns schema-valid JSON when a schema is set."""

    model_name: str = MOCK_MODEL_ID

    @property
    def _llm_type(self) -> str:
        return MOCK_MODEL_ID

    @property
    def _identifying_params(self) -> Mapping[str, Any]:
        return {"model_name": self.model_name}

    def bind_tools(self, tools: Any, **kwargs: Any) -> "MockProviderChatModel":
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        content = self._next_content()
        message = AIMessage(
            content=content,
            response_metadata={"model_name": self.model_name},
        )
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    def _next_content(self) -> str:
        schema = _mock_output_schema.get()
        if schema is not None:
            return json.dumps(generate_mock_payload(schema))
        return json.dumps({"mock": True})
