"""
Feature pipeline composer — the single entry point for feature engineering.

Wires together all feature groups in the correct order:
  1. normalization  (DataFrame creation, timestamp sort, derived base cols)
  2. transaction    (calendar, categorical encodings, missingness indicators)
  3. behavioral     (velocity windows, amount deviation — requires sort)
  4. device_ip      (device/IP sharing — requires sort + behavioral done)
  5. sequence       (time-since-prev, velocity acceleration — requires behavioral)
  6. graph          (Milestone 7 — plugged in via optional hook)
  7. fill_values    (replace NaN with safe constants from base.FILL_VALUES)
  8. select_columns (return only the declared ML feature columns)

Usage
─────
Training:
    result = run_feature_pipeline(
        transactions=accepted_transactions,
        customer_contexts=ctx_map,
        fit_scaler=True,
    )
    X_train      = result.feature_matrix    # shape (n, len(ALL_FEATURE_COLUMNS))
    y_train      = result.labels            # pd.Series[bool|None]
    scaler       = result.scaler            # save alongside the model
    data_quality = result.quality_stats

Inference (single transaction or batch):
    result = run_feature_pipeline(
        transactions=[tx],
        customer_contexts={tx.customer_id: ctx},
        scaler=saved_scaler,   # must match training scaler
    )
    X_infer = result.feature_matrix

LEAKAGE GUARANTEE
─────────────────
This function never fits transformers on validation or test data.
The caller is responsible for:
  - Passing fit_scaler=True ONLY on the training split.
  - Passing the stored scaler for all other splits and for inference.
  - Ensuring customer_contexts contain only information available
    strictly before each transaction's timestamp.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable

import numpy as np
import pandas as pd

from zeno_ml.data.normalization import normalize_transactions
from zeno_ml.data.schema import CustomerContext, DataQualityStats, RawTransaction
from zeno_ml.features.base import ALL_FEATURE_COLUMNS, FEATURE_VERSION, FILL_VALUES
from zeno_ml.features.behavioral import add_behavioral_features
from zeno_ml.features.device_ip import add_device_ip_features
from zeno_ml.features.sequence import add_sequence_features
from zeno_ml.features.transaction import add_transaction_features

if TYPE_CHECKING:
    from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class FeaturePipelineResult:
    """
    Output of run_feature_pipeline().

    feature_matrix : shape (n_samples, n_features)
                     columns = ALL_FEATURE_COLUMNS, dtype float64
                     Ready to pass directly to XGBoost / sklearn.
    labels         : pd.Series[bool|None], same length as feature_matrix.
                     None means unlabeled (inference).
    transaction_ids: list of transaction_id strings, aligned to feature_matrix rows.
    customer_ids   : list of customer_id strings, aligned to feature_matrix rows.
    feature_version: FEATURE_VERSION constant — logged with every model.
    scaler         : fitted StandardScaler if fit_scaler=True, else None.
    quality_stats  : DataQualityStats (pass-through from validation if available).
    full_df        : full normalized DataFrame with all columns (for debugging).
    """
    feature_matrix:  pd.DataFrame
    labels:          pd.Series
    transaction_ids: list[str]
    customer_ids:    list[str]
    feature_version: str = FEATURE_VERSION
    scaler:          "StandardScaler | None" = None
    quality_stats:   DataQualityStats = field(default_factory=DataQualityStats)
    full_df:         pd.DataFrame = field(default_factory=pd.DataFrame)


# ---------------------------------------------------------------------------
# Graph feature hook (filled in Milestone 7)
# ---------------------------------------------------------------------------

# Optional hook: signature (df: DataFrame) -> DataFrame
# When None, graph features are skipped (filled with defaults).
# Milestone 7 will call register_graph_feature_hook() to plug in the
# NetworkX-based graph feature computation.
_graph_feature_hook: Callable[[pd.DataFrame], pd.DataFrame] | None = None


def register_graph_feature_hook(
    hook: Callable[[pd.DataFrame], pd.DataFrame],
) -> None:
    """
    Register a function that adds graph-derived features to the DataFrame.

    Called once at application startup by the graph module (Milestone 7).
    The hook receives the fully sorted DataFrame and returns it with graph
    feature columns appended.
    """
    global _graph_feature_hook
    _graph_feature_hook = hook
    logger.info("Graph feature hook registered.")


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

def run_feature_pipeline(
    transactions: list[RawTransaction],
    customer_contexts: dict[str, CustomerContext] | None = None,
    fit_scaler: bool = False,
    scaler: "StandardScaler | None" = None,
    quality_stats: DataQualityStats | None = None,
    include_graph_features: bool = True,
) -> FeaturePipelineResult:
    """
    Run the complete feature engineering pipeline.

    Parameters
    ----------
    transactions :
        Validated RawTransaction objects (output of DataQualityValidator).
    customer_contexts :
        Mapping customer_id -> CustomerContext for historical context.
        Optional — features fall back to in-DataFrame computation when absent.
    fit_scaler :
        True only on training data. Fits StandardScaler on continuous columns.
    scaler :
        Pre-fit scaler from training. Provide for val/test/inference splits.
    quality_stats :
        DataQualityStats from the validation step; forwarded to the result.
    include_graph_features :
        Whether to run the graph feature hook if registered. Set False to
        run the ablation without graph features.

    Returns
    -------
    FeaturePipelineResult
    """
    if not transactions:
        logger.warning("run_feature_pipeline called with empty transaction list.")
        empty = pd.DataFrame(columns=ALL_FEATURE_COLUMNS)
        return FeaturePipelineResult(
            feature_matrix=empty,
            labels=pd.Series(dtype=object),
            transaction_ids=[],
            customer_ids=[],
        )

    # ── Step 1: normalization ─────────────────────────────────────────────
    norm = normalize_transactions(
        transactions,
        fit_scaler=fit_scaler,
        scaler=scaler,
    )
    df           = norm.df
    label_series = norm.label_series
    fitted_scaler = norm.scaler

    logger.debug("Normalization complete: %d rows.", len(df))

    # ── Step 2: transaction features ─────────────────────────────────────
    add_transaction_features(df)

    # ── Step 3: behavioral features ──────────────────────────────────────
    add_behavioral_features(df, customer_contexts=customer_contexts)

    # ── Step 4: device/IP features ───────────────────────────────────────
    add_device_ip_features(df)

    # ── Step 5: sequence features ─────────────────────────────────────────
    add_sequence_features(df)

    # ── Step 6: graph features (optional hook) ────────────────────────────
    if include_graph_features and _graph_feature_hook is not None:
        df = _graph_feature_hook(df)
        logger.debug("Graph feature hook applied.")

    # ── Step 7: fill missing values with safe constants ──────────────────
    _apply_fill_values(df)

    # ── Step 8: build final feature matrix ───────────────────────────────
    feature_matrix = _select_feature_columns(df)

    # Align labels to feature_matrix index
    labels = label_series.reindex(feature_matrix.index)

    logger.info(
        "Feature pipeline complete: %d rows × %d features (version %s).",
        len(feature_matrix),
        len(feature_matrix.columns),
        FEATURE_VERSION,
    )

    return FeaturePipelineResult(
        feature_matrix=feature_matrix,
        labels=labels,
        transaction_ids=df["transaction_id"].tolist(),
        customer_ids=df["customer_id"].tolist(),
        feature_version=FEATURE_VERSION,
        scaler=fitted_scaler,
        quality_stats=quality_stats or DataQualityStats(),
        full_df=df,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _apply_fill_values(df: pd.DataFrame) -> None:
    """
    Replace NaN in feature columns with the safe sentinel constants defined
    in base.FILL_VALUES.  Any remaining NaN is replaced with 0.0.

    This is the last operation before feature matrix extraction — all
    upstream code is allowed to leave NaN; this function normalises them.
    """
    for col, fill in FILL_VALUES.items():
        if col in df.columns:
            df[col] = df[col].fillna(fill)

    # Catch-all: any remaining NaN in feature columns → 0.0
    feature_cols_present = [c for c in ALL_FEATURE_COLUMNS if c in df.columns]
    df[feature_cols_present] = df[feature_cols_present].fillna(0.0)


def _select_feature_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a DataFrame containing only ALL_FEATURE_COLUMNS.

    Columns declared in ALL_FEATURE_COLUMNS but absent from df are
    added as 0.0 (with a warning — this indicates the pipeline is
    missing a feature group, likely because graph features are not yet
    available).

    SAFETY: label columns (is_fraud, is_refunded, refund_amount) are
    explicitly excluded even if somehow present.
    """
    FORBIDDEN = {"is_fraud", "is_refunded", "refund_amount"}

    result_cols: dict[str, pd.Series] = {}
    missing_reported: list[str] = []

    for col in ALL_FEATURE_COLUMNS:
        if col in FORBIDDEN:
            continue
        if col in df.columns:
            result_cols[col] = df[col].astype(np.float64)
        else:
            missing_reported.append(col)
            result_cols[col] = pd.Series(0.0, index=df.index, dtype=np.float64)

    if missing_reported:
        logger.warning(
            "Feature columns missing from DataFrame (filled with 0.0): %s",
            missing_reported,
        )

    return pd.DataFrame(result_cols, index=df.index)


# ---------------------------------------------------------------------------
# Leakage audit utility (used by tests and CI)
# ---------------------------------------------------------------------------

def audit_for_leakage(feature_matrix: pd.DataFrame) -> list[str]:
    """
    Lightweight automated leakage check.

    Inspects the feature matrix for columns that should never be present
    (post-transaction outcomes or raw labels).

    Returns a list of offending column names (empty = no detected leakage).
    This does NOT catch all forms of leakage — temporal window correctness
    must be verified through the unit tests in tests/test_leakage.py.
    """
    FORBIDDEN_IN_FEATURES = {
        "is_fraud",
        "is_refunded",
        "refund_amount",
        "fraud_label",
        "label",
        "target",
        "y",
    }
    offenders = [c for c in feature_matrix.columns if c in FORBIDDEN_IN_FEATURES]
    if offenders:
        logger.error(
            "LEAKAGE DETECTED: forbidden columns in feature matrix: %s",
            offenders,
        )
    return offenders
