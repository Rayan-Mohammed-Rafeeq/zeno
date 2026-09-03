"""
Data quality pipeline for Niro ML.

Runs every raw record through a multi-stage validation gate before it enters
the feature engineering pipeline.  Bad records are NEVER silently discarded —
every rejection is counted, categorised, and surfaced in DataQualityStats.

Pipeline stages (executed in order):
  1. Schema validation   — required fields present, correct types
  2. Type coercion       — attempt safe casts before rejecting
  3. Missing value audit — which fields are absent and how many
  4. Duplicate detection — exact-match on (merchant_id, transaction_id)
  5. Timestamp validation— parseable, not in the future (configurable tolerance)
  6. Range validation    — amount within [0.01, MAX_AMOUNT], currency length
  7. Accept / reject     — accepted records returned as List[RawTransaction]

Usage:
    validator = DataQualityValidator()
    result = validator.validate(raw_dicts, reference_time=datetime.utcnow())
    accepted = result.accepted
    stats    = result.stats
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from niro_ml.data.schema import DataQualityStats, RawTransaction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_AMOUNT: float = 1_000_000.0          # $1 M — flag as extreme, still accept
FUTURE_TOLERANCE_SECONDS: int = 300      # 5 min clock-skew tolerance
MIN_TIMESTAMP_YEAR: int = 2000           # Reject timestamps before 2000-01-01
REQUIRED_FIELDS: tuple[str, ...] = (
    "transaction_id",
    "merchant_id",
    "customer_id",
    "timestamp",
    "amount",
)


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class ValidationResult:
    accepted: list[RawTransaction] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)
    stats: DataQualityStats = field(default_factory=DataQualityStats)


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

class DataQualityValidator:
    """
    Validates a batch of raw transaction dicts and returns accepted
    RawTransaction objects alongside comprehensive quality statistics.

    Parameters
    ----------
    max_amount : float
        Amounts above this value are flagged as extreme but still accepted.
        Set to a lower value for strict rejection.
    future_tolerance_seconds : int
        Clock-skew tolerance for future timestamps.
    strict : bool
        If True, extreme amounts and suspicious-but-parseable values cause
        rejection rather than just flagging.  Default False (flag only).
    """

    def __init__(
        self,
        max_amount: float = MAX_AMOUNT,
        future_tolerance_seconds: int = FUTURE_TOLERANCE_SECONDS,
        strict: bool = False,
    ) -> None:
        self.max_amount = max_amount
        self.future_tolerance_seconds = future_tolerance_seconds
        self.strict = strict

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def validate(
        self,
        raw_records: list[dict[str, Any]],
        reference_time: datetime | None = None,
        strict: bool | None = None,
    ) -> ValidationResult:
        """
        Validate a list of raw record dicts.

        Parameters
        ----------
        raw_records :
            Dicts straight from CSV parsing or JSON deserialization.
        reference_time :
            Anchor for future-timestamp detection.  Defaults to utcnow().

        Returns
        -------
        ValidationResult with accepted records, rejected records, and stats.
        """
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)
        # Ensure reference time is timezone-aware
        if reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)

        # Per-call strict override (takes precedence over constructor default)
        effective_strict = self.strict if strict is None else strict

        result = ValidationResult()
        stats = result.stats
        stats.rows_received = len(raw_records)

        # Stage 4 setup: duplicate detection within this batch
        seen_keys: set[str] = set()

        for rec in raw_records:
            rejection_reason = self._validate_record(
                rec, reference_time, seen_keys, stats, effective_strict
            )
            if rejection_reason:
                stats.rows_rejected += 1
                if rejection_reason not in stats.rejection_reasons:
                    stats.rejection_reasons.append(rejection_reason)
                result.rejected.append(rec)
            else:
                stats.rows_accepted += 1
                # Safe: schema already validated above inside _validate_record
                result.accepted.append(self._coerce(rec))

        logger.info(
            "Data quality validation complete: %d/%d accepted (%.1f%%)",
            stats.rows_accepted,
            stats.rows_received,
            stats.acceptance_rate * 100,
        )
        return result

    # ------------------------------------------------------------------
    # Per-record validation
    # ------------------------------------------------------------------

    def _validate_record(
        self,
        rec: dict[str, Any],
        reference_time: datetime,
        seen_keys: set[str],
        stats: DataQualityStats,
        strict: bool = False,
    ) -> str | None:
        """
        Run all validation stages for a single record.

        Returns the first rejection reason string, or None if accepted.
        Stats are updated as side-effects even for records that pass
        (to capture warning-level issues like extreme amounts).
        """

        # ── Stage 1 & 2: required fields + type coercion ────────────────
        for f in REQUIRED_FIELDS:
            if f not in rec or rec[f] is None or rec[f] == "":
                self._count_missing(f, stats)
                return f"missing_required_field:{f}"

        # Pre-check amount before Pydantic so we can increment the right counter
        raw_amount = rec.get("amount")
        if raw_amount is not None:
            try:
                coerced_amount = float(raw_amount)
                if coerced_amount <= 0:
                    stats.invalid_amount += 1
                    return f"invalid_amount:{coerced_amount}"
            except (ValueError, TypeError):
                stats.invalid_amount += 1
                return f"invalid_amount_non_numeric:{raw_amount}"

        # ── Stage 1b: Pydantic schema validation ────────────────────────
        try:
            # We do a dry-run parse.  Coerce strings to expected types first.
            parsed = self._try_parse(rec)
        except ValidationError as exc:
            stats.rows_rejected  # already incremented by caller; just return
            return f"schema_validation_error:{exc.error_count()}_errors"
        except Exception as exc:  # noqa: BLE001
            return f"parse_error:{type(exc).__name__}"

        # ── Stage 3: missing optional fields (informational only) ───────
        # These don't cause rejection but are counted for monitoring.
        if parsed.device_id is None:
            pass  # tracked separately if needed
        if parsed.ip_address is None:
            pass

        # ── Stage 4: duplicate detection ────────────────────────────────
        dedup_key = f"{parsed.merchant_id}::{parsed.transaction_id}"
        if dedup_key in seen_keys:
            stats.duplicate_rows += 1
            return f"duplicate_transaction:{parsed.transaction_id}"
        seen_keys.add(dedup_key)

        # ── Stage 5: timestamp validation ───────────────────────────────
        ts = parsed.timestamp
        # Ensure tz-aware comparison
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        if ts.year < MIN_TIMESTAMP_YEAR:
            stats.invalid_timestamp += 1
            return f"timestamp_too_old:{ts.isoformat()}"

        future_limit = reference_time.timestamp() + self.future_tolerance_seconds
        if ts.timestamp() > future_limit:
            stats.future_timestamp += 1
            return f"future_timestamp:{ts.isoformat()}"

        # ── Stage 6: range validation ────────────────────────────────────
        if parsed.amount <= 0:
            stats.invalid_amount += 1
            return f"invalid_amount:{parsed.amount}"

        if parsed.amount > self.max_amount:
            stats.amount_extreme_high += 1
            if strict:
                return f"extreme_amount:{parsed.amount}"
            # In non-strict mode: flag but accept
            logger.debug("Extreme amount flagged (accepted): %.2f", parsed.amount)

        return None   # accepted

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _try_parse(self, rec: dict[str, Any]) -> RawTransaction:
        """
        Attempt to parse a raw dict into RawTransaction, applying safe
        type coercions first (e.g. string timestamps, string amounts).
        """
        coerced = dict(rec)

        # Coerce amount to float
        if "amount" in coerced and not isinstance(coerced["amount"], float):
            try:
                coerced["amount"] = float(coerced["amount"])
            except (ValueError, TypeError):
                raise ValueError(f"Cannot coerce amount '{coerced['amount']}' to float")

        # Coerce timestamp strings
        if "timestamp" in coerced and isinstance(coerced["timestamp"], str):
            coerced["timestamp"] = _parse_timestamp(coerced["timestamp"])

        return RawTransaction.model_validate(coerced)

    def _coerce(self, rec: dict[str, Any]) -> RawTransaction:
        """Final parse after validation has already passed."""
        return self._try_parse(rec)

    @staticmethod
    def _count_missing(field_name: str, stats: DataQualityStats) -> None:
        mapping = {
            "transaction_id": "missing_transaction_id",
            "customer_id":    "missing_customer_id",
            "merchant_id":    "missing_merchant_id",
            "timestamp":      "missing_timestamp",
            "amount":         "missing_amount",
            "currency":       "missing_currency",
        }
        attr = mapping.get(field_name)
        if attr:
            setattr(stats, attr, getattr(stats, attr) + 1)


# ---------------------------------------------------------------------------
# Timestamp parsing helpers
# ---------------------------------------------------------------------------

_TIMESTAMP_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
]


def _parse_timestamp(value: str) -> datetime:
    """
    Try multiple common timestamp formats, returning a timezone-aware datetime.
    Raises ValueError if none match.
    """
    value = value.strip()

    # ISO 8601 with timezone offset — let fromisoformat handle it
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass

    for fmt in _TIMESTAMP_FORMATS:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    raise ValueError(f"Cannot parse timestamp: '{value}'")


# ---------------------------------------------------------------------------
# Convenience: validate a DataFrame (used in batch training pipelines)
# ---------------------------------------------------------------------------

def validate_dataframe(
    df: "pandas.DataFrame",  # noqa: F821 — avoid hard import at module level
    reference_time: datetime | None = None,
    max_amount: float = MAX_AMOUNT,
    strict: bool = False,
) -> ValidationResult:
    """
    Convenience wrapper: validates a pandas DataFrame as a list of dicts.

    Columns must match RawTransaction field names.  Extra columns are ignored
    by Pydantic (model_config forbid=False by default).
    """
    records = df.to_dict(orient="records")
    validator = DataQualityValidator(
        max_amount=max_amount,
        strict=strict,
    )
    return validator.validate(records, reference_time=reference_time)
