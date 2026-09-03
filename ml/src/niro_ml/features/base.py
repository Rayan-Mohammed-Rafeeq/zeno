"""
Feature versioning constants and base utilities.

FEATURE_VERSION is bumped whenever the feature schema changes in a way
that would make a model trained on version N incompatible with features
computed on version N+1.  MLflow logs this alongside every experiment.

Version history:
  1.0 — initial schema: transaction + behavioral + device/IP + sequence features
"""

from __future__ import annotations

FEATURE_VERSION: str = "1.0"

# ---------------------------------------------------------------------------
# Feature group names — used for ablation study bookkeeping
# ---------------------------------------------------------------------------
GROUP_TRANSACTION = "transaction"
GROUP_BEHAVIORAL  = "behavioral"
GROUP_DEVICE_IP   = "device_ip"
GROUP_SEQUENCE    = "sequence"
GROUP_GRAPH       = "graph"      # added in Milestone 7

# ---------------------------------------------------------------------------
# Ordered list of all feature column names produced by the v1.0 pipeline.
# Downstream code (model training, SHAP, inference) should reference this
# list rather than hard-coding column positions.
# ---------------------------------------------------------------------------

TRANSACTION_FEATURES: list[str] = [
    "amount",
    "log_amount",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "is_night",           # 00:00–06:00 local hour
    "payment_method_enc",
    "merchant_category_enc",
    "country_mismatch",   # 1=mismatch, 0=match, -1=unknown
    "has_device_id",
    "has_ip_address",
    "has_billing_country",
    "has_shipping_country",
]

BEHAVIORAL_FEATURES: list[str] = [
    "tx_count_5min",
    "tx_count_1h",
    "tx_count_24h",
    "amount_sum_1h",
    "amount_sum_24h",
    "customer_avg_amount_historical",
    "customer_median_amount_historical",
    "amount_deviation_from_mean",       # (amount - mean) / (std + ε)
    "amount_zscore",
    "account_age_days",
    "account_age_missing",              # indicator: 1 if account_age_days was None
    "historical_refund_rate",
    "historical_refund_rate_missing",   # indicator: 1 if no prior labeled history
    "historical_fraud_rate",
    "historical_fraud_rate_missing",
]

DEVICE_IP_FEATURES: list[str] = [
    "customers_per_device",             # distinct customers sharing this device
    "tx_per_device_24h",
    "device_velocity_1h",
    "devices_per_customer_historical",
    "device_missing",
    "customers_per_ip",
    "tx_per_ip_24h",
    "ip_velocity_1h",
    "ips_per_customer_historical",
    "ip_missing",
    "devices_per_ip",                   # graph-derived, proxy for shared infra
]

SEQUENCE_FEATURES: list[str] = [
    "seconds_since_prev_tx",
    "seconds_since_prev_tx_missing",    # 1 if first transaction for customer
    "amount_change_from_prev",          # amount - prev_amount
    "amount_change_pct",                # (amount - prev) / (prev + ε)
    "velocity_acceleration",            # tx_count_1h / (tx_count_24h + ε)
    "repeated_amount",                  # 1 if amount matches any prior tx within 24h (±1%)
]

ALL_FEATURE_COLUMNS: list[str] = (
    TRANSACTION_FEATURES
    + BEHAVIORAL_FEATURES
    + DEVICE_IP_FEATURES
    + SEQUENCE_FEATURES
)

# Sentinel fill values for missing data — consistent across train and inference
FILL_VALUES: dict[str, float] = {
    "account_age_days":                 -1.0,  # -1 signals "unknown"
    "historical_refund_rate":            0.0,
    "historical_fraud_rate":             0.0,
    "seconds_since_prev_tx":             0.0,
    "amount_change_from_prev":           0.0,
    "amount_change_pct":                 0.0,
    "customers_per_device":              1.0,  # assume unique if unknown
    "customers_per_ip":                  1.0,
    "tx_per_device_24h":                 0.0,
    "tx_per_ip_24h":                     0.0,
    "device_velocity_1h":                0.0,
    "ip_velocity_1h":                    0.0,
    "devices_per_ip":                    1.0,
    "devices_per_customer_historical":   1.0,
    "ips_per_customer_historical":       1.0,
    "customer_avg_amount_historical":    0.0,
    "customer_median_amount_historical": 0.0,
    "amount_deviation_from_mean":        0.0,
    "amount_zscore":                     0.0,
    "velocity_acceleration":             0.0,
}
