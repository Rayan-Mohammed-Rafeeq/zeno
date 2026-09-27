"""core/logging.py — Structured JSON logging for Zeno AI.

Adapted from langgraph-agent-stack/core/observability.py.
PHI fields are never logged — only IDs and metadata.
"""
from __future__ import annotations

import contextvars
import logging
from typing import Any

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)

#: Fields that must never appear in structured log output
_PHI_FIELDS = frozenset({
    "patient_name", "first_name", "last_name", "date_of_birth",
    "email", "phone_number", "mrn", "medication_name",
    "medication_strength", "instructions", "notes",
})


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> str:
    return _request_id_var.get()


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()  # type: ignore[attr-defined]
        return True


class _PhiRedactFilter(logging.Filter):
    """Redact known PHI keys from structured log extras."""

    _PROTECTED = frozenset({
        "name", "msg", "args", "created", "relativeCreated", "exc_info",
        "exc_text", "stack_info", "lineno", "funcName", "pathname",
        "filename", "module", "levelno", "levelname", "message", "msecs",
        "process", "processName", "thread", "threadName", "request_id", "taskName",
    })

    def filter(self, record: logging.LogRecord) -> bool:
        for key in list(record.__dict__):
            if key.startswith("_") or key in self._PROTECTED:
                continue
            if key in _PHI_FIELDS:
                setattr(record, key, "[REDACTED]")
        return True


def configure_logging(level: str = "INFO") -> None:
    """Configure structured JSON logging (falls back to text if pythonjsonlogger absent)."""
    root = logging.getLogger()
    root.setLevel(level)

    for h in root.handlers[:]:
        root.removeHandler(h)

    handler = logging.StreamHandler()
    handler.setLevel(level)

    try:
        from pythonjsonlogger.json import JsonFormatter

        formatter = JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        )
    except ImportError:
        formatter = logging.Formatter(  # type: ignore[assignment]
            "%(asctime)s %(levelname)s %(name)s %(message)s"
        )

    handler.setFormatter(formatter)
    handler.addFilter(_RequestIdFilter())
    handler.addFilter(_PhiRedactFilter())
    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("langchain").setLevel(logging.WARNING)
    logging.getLogger("langgraph").setLevel(logging.WARNING)


def phi_safe_extra(data: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``data`` with PHI fields replaced by [REDACTED].

    Use this when building ``extra=`` kwargs for log calls that might
    inadvertently include PHI from request payloads.
    """
    return {k: ("[REDACTED]" if k in _PHI_FIELDS else v) for k, v in data.items()}
