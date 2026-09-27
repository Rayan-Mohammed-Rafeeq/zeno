"""core/security.py — Request validation and PHI input sanitisation.

Treats all free-text fields from pharmacy/patient/provider messages as
untrusted data. They are passed as DATA to prompts, never as instructions.
"""
from __future__ import annotations

import re
from typing import Any


#: Fields that may contain untrusted free-text from external parties.
#: These are sanitised before being embedded in prompts.
UNTRUSTED_TEXT_FIELDS = frozenset({
    "notes", "reason", "instructions", "pharmacy_message",
    "patient_message", "provider_notes", "description",
})

_NULL_BYTE_RE = re.compile(r"\x00")
_MAX_FIELD_LENGTH = 2000
_MAX_PAYLOAD_BYTES = 512 * 1024  # 512 KiB


class InputValidationError(ValueError):
    """Raised when request input fails safety checks."""


def validate_text_field(value: str, field_name: str = "field") -> str:
    """Validate a single text field for length and null bytes.

    Args:
        value: The string to validate.
        field_name: Name for error messages.

    Returns:
        The validated (and whitespace-normalised) string.

    Raises:
        InputValidationError: On null bytes or excessive length.
    """
    if _NULL_BYTE_RE.search(value):
        raise InputValidationError(f"{field_name}: null bytes are not allowed")
    if len(value) > _MAX_FIELD_LENGTH:
        raise InputValidationError(
            f"{field_name}: exceeds maximum length of {_MAX_FIELD_LENGTH} characters"
        )
    return value.strip()


def sanitize_untrusted_text(text: str) -> str:
    """Sanitise free-text that originates from untrusted external parties.

    Strips leading/trailing whitespace and truncates to prevent prompt injection
    via oversized inputs. The text is wrapped as DATA in prompts — never as
    system instructions.
    """
    if not isinstance(text, str):
        return ""
    cleaned = _NULL_BYTE_RE.sub("", text).strip()
    if len(cleaned) > _MAX_FIELD_LENGTH:
        cleaned = cleaned[:_MAX_FIELD_LENGTH] + "... [truncated]"
    return cleaned


def sanitize_payload_for_prompt(data: dict[str, Any]) -> dict[str, Any]:
    """Return a sanitised copy of ``data`` safe for embedding in AI prompts.

    Untrusted text fields are sanitised; non-string values are passed through.
    """
    result: dict[str, Any] = {}
    for key, value in data.items():
        if key in UNTRUSTED_TEXT_FIELDS and isinstance(value, str):
            result[key] = sanitize_untrusted_text(value)
        else:
            result[key] = value
    return result
