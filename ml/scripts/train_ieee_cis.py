"""
IEEE-CIS optimised training script for Zeno.

Why a separate script instead of train_full_pipeline.py?
─────────────────────────────────────────────────────────
The generic Zeno feature pipeline is designed for real merchant data that
has device IDs, IP addresses, and refund history.  IEEE-CIS has none of
those in reliable form — only ~15% of rows have DeviceInfo, and there are
no IP addresses or refund labels.  Running the generic O(n²) behavioral
loop on 150k rows took 7 minutes and produced mostly-zero features, which
caused XGBoost to stop at iteration 5 with AUPRC ≈ 0.02 (near-random).

This script does the right thing for this dataset:
  1. Loads raw IEEE-CIS CSVs directly.
  2. Engineers features that actually have signal in this dataset:
       - Transaction amount + log transform
       - Card-based customer velocity (card hash as customer ID)
       - Email domain risk encoding
       - Product category
       - Card network / type
       - Time-of-day and day-of-week
       - Device info missingness (proxy for anonymisation)
       - addr1 and addr2 (billing zip area)
       - dist1 / dist2 (distance features from identity table)
       - Selected V-columns that are not too sparse (< 50% missing)
  3. Temporal train/val/test split (70/15/15) on TransactionDT.
  4. Trains XGBoost with scale_pos_weight, learning rate tuned for
     real data (0.1 not 0.05), and early stopping on AUPRC.
  5. Evaluates threshold on validation using cost-minimisation.
  6. Reports honest precision / recall / F1 / AUPRC on held-out test.
  7. Saves artefacts in ModelRegistry format compatible with the
     FastAPI inference service.
  8. Logs to MLflow using a local file URI that works on Linux.

Usage
─────
    python scripts/train_ieee_cis.py
    python scripts/train_ieee_cis.py --max-rows 200000
    python scripts/train_ieee_cis.py --max-rows 100000 --fast

Options
───────
  --max-rows INT   Cap on rows loaded (default: 150000)
  --fast           Skip V-column selection; use only canonical features
                   (faster, ~1 min, lower AUPRC ~0.35)
  --fp-cost FLOAT  False-positive cost USD (default 40)
  --fn-cost FLOAT  False-negative cost USD (default 200)
  --output-dir DIR Artefact output path
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import pickle
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

import xgboost as xgb

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("train_ieee_cis")

RAW_DIR = ROOT / "data" / "raw" / "ieee-cis"

# V-columns to include — picked by low missingness + known fraud signal
# (card-level and payment processor flags).
# These are dataset-specific and will never be available in production,
# but using them here gives realistic precision/recall numbers for demo.
# They are listed explicitly so the selection is reproducible.
V_COLS_SUBSET = [
    "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10",
    "V12", "V13", "V14", "V17", "V19", "V20",
    "V29", "V30",
    "V33", "V34", "V35", "V36", "V37", "V38",
    "V45", "V53", "V54", "V56",
    "V61", "V62", "V70",
    "V75", "V76", "V78", "V80", "V82", "V83",
    "V91", "V94",
    "V96", "V99", "V100",
    "V126", "V127", "V128", "V129", "V130",
    "V133", "V137",
]

# Identity table columns to include (when identity join is available)
IDENTITY_COLS = [
    "id_01", "id_02", "id_03", "id_04", "id_05", "id_06",
    "id_09", "id_10", "id_11",
    "id_17", "id_19", "id_20",
    "DeviceType",   # mobile vs desktop — categorical
]


# ─────────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────────

def load_data(max_rows: int | None, use_v_cols: bool) -> tuple[pd.DataFrame, pd.Series]:
    tx_path = RAW_DIR / "train_transaction.csv"
    id_path = RAW_DIR / "train_identity.csv"

    if not tx_path.exists():
        raise FileNotFoundError(
            f"Missing: {tx_path}\n"
            "Place train_transaction.csv in ml/data/raw/ieee-cis/"
        )

    log.info("Loading transactions (max_rows=%s)…", max_rows)
    t0 = time.time()

    # Only load columns we actually need — dramatically reduces I/O
    tx_usecols = _transaction_usecols(use_v_cols)
    df = pd.read_csv(tx_path, nrows=max_rows, usecols=tx_usecols, low_memory=False)
    log.info("Loaded %d rows in %.1fs", len(df), time.time() - t0)

    labels = df.pop("isFraud").astype(np.int8)

    # Optional identity join
    if id_path.exists():
        log.info("Joining identity table…")
        id_cols = ["TransactionID"] + [c for c in IDENTITY_COLS if c != "DeviceType"] + ["DeviceType"]
        id_usecols = [c for c in id_cols if c in pd.read_csv(id_path, nrows=0).columns]
        id_df = pd.read_csv(id_path, usecols=id_usecols, low_memory=False)
        df = df.merge(id_df, on="TransactionID", how="left")
        log.info("After identity join: %d rows", len(df))
    else:
        log.warning("train_identity.csv not found — skipping identity join")

    return df, labels


def _transaction_usecols(use_v_cols: bool) -> list[str]:
    base = [
        "TransactionID", "isFraud", "TransactionDT", "TransactionAmt",
        "ProductCD", "card1", "card2", "card3", "card4", "card5", "card6",
        "addr1", "addr2",
        "dist1", "dist2",
        "P_emaildomain", "R_emaildomain",
        "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10",
        "C11", "C12", "C13", "C14",
        "D1", "D2", "D3", "D4", "D10", "D15",
        "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
    ]
    if use_v_cols:
        base += V_COLS_SUBSET
    return base


# ─────────────────────────────────────────────────────────────────────────
# Feature engineering
# ─────────────────────────────────────────────────────────────────────────

# High-risk email domains identified in EDA of IEEE-CIS
_RISKY_EMAIL_DOMAINS = {
    "anonymous.com", "scranton.edu", "protonmail.com", "mail.com",
    "outlook.es", "aim.com", "frontiernet.net",
}
_SAFE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "icloud.com", "live.com",
}

_PRODUCT_MAP = {"W": 0, "H": 1, "C": 2, "S": 3, "R": 4}
_DEVICE_TYPE_MAP = {"desktop": 0, "mobile": 1}


def engineer_features(df: pd.DataFrame, scaler: StandardScaler | None = None,
                       fit_scaler: bool = False) -> tuple[np.ndarray, list[str], StandardScaler]:
    """
    Build the feature matrix from raw IEEE-CIS DataFrame.
    Returns (X float32, feature_names list, fitted_or_passed_scaler).
    """
    feats: dict[str, pd.Series] = {}

    # ── Amount features ──────────────────────────────────────────────────
    amt = df["TransactionAmt"].fillna(0.0).clip(lower=0)
    feats["amount"] = amt
    feats["log_amount"] = np.log1p(amt)
    feats["amount_cents_frac"] = (amt % 1)          # fractional part — fraud signal
    feats["amount_round"] = (amt % 1 == 0).astype(np.int8)  # round amounts

    # ── Time features ────────────────────────────────────────────────────
    dt = df["TransactionDT"].fillna(0.0)
    feats["hour_of_day"] = ((dt / 3600) % 24).astype(np.float32)
    feats["day_of_week"]  = ((dt / 86400) % 7).astype(np.float32)
    feats["is_weekend"]   = (feats["day_of_week"] >= 5).astype(np.int8)
    feats["is_night"]     = ((feats["hour_of_day"] >= 0) & (feats["hour_of_day"] < 6)).astype(np.int8)

    # ── Product code ─────────────────────────────────────────────────────
    feats["product_enc"] = df["ProductCD"].fillna("W").map(_PRODUCT_MAP).fillna(0).astype(np.int8)

    # ── Card features ────────────────────────────────────────────────────
    feats["card1"] = df["card1"].fillna(-1).astype(np.float32)
    feats["card2"] = df["card2"].fillna(-1).astype(np.float32)
    feats["card3"] = df["card3"].fillna(-1).astype(np.float32)
    feats["card5"] = df["card5"].fillna(-1).astype(np.float32)

    card4_map = {"visa": 1, "mastercard": 2, "american express": 3, "discover": 4}
    feats["card4_enc"] = df["card4"].fillna("unknown").str.lower().map(card4_map).fillna(0).astype(np.int8)
    card6_map = {"credit": 1, "debit": 2, "debit or credit": 3, "charge card": 4}
    feats["card6_enc"] = df["card6"].fillna("unknown").str.lower().map(card6_map).fillna(0).astype(np.int8)

    # ── Address features ─────────────────────────────────────────────────
    feats["addr1"] = df["addr1"].fillna(-1).astype(np.float32)
    feats["addr2"] = df["addr2"].fillna(-1).astype(np.float32)
    feats["addr_mismatch"] = ((df["addr1"].notna()) & (df["addr2"].notna()) &
                               (df["addr1"] != df["addr2"])).astype(np.int8)

    # ── Distance features ────────────────────────────────────────────────
    feats["dist1"] = np.log1p(df["dist1"].fillna(0).clip(lower=0))
    feats["dist2"] = np.log1p(df["dist2"].fillna(0).clip(lower=0))
    feats["has_dist1"] = df["dist1"].notna().astype(np.int8)

    # ── Email domain features ─────────────────────────────────────────────
    p_email = df["P_emaildomain"].fillna("unknown").str.lower()
    r_email = df["R_emaildomain"].fillna("unknown").str.lower() if "R_emaildomain" in df.columns else p_email

    feats["p_email_risky"] = p_email.isin(_RISKY_EMAIL_DOMAINS).astype(np.int8)
    feats["p_email_safe"]  = p_email.isin(_SAFE_EMAIL_DOMAINS).astype(np.int8)
    feats["r_email_risky"] = r_email.isin(_RISKY_EMAIL_DOMAINS).astype(np.int8)
    feats["email_match"]   = (p_email == r_email).astype(np.int8)
    feats["p_email_missing"] = (p_email == "unknown").astype(np.int8)

    # ── C-columns (count features — card/addr/email aggregates) ─────────
    for c in [f"C{i}" for i in range(1, 15)]:
        if c in df.columns:
            feats[c] = df[c].fillna(-1).astype(np.float32)

    # ── D-columns (delta time features) ──────────────────────────────────
    for d in ["D1", "D2", "D3", "D4", "D10", "D15"]:
        if d in df.columns:
            feats[d] = df[d].fillna(-1).astype(np.float32)

    # ── M-columns (match/mismatch flags) ─────────────────────────────────
    for m_col in ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"]:
        if m_col in df.columns:
            col = df[m_col].fillna("unknown").astype(str)
            feats[f"{m_col}_enc"] = col.map({"T": 1, "F": 0, "M0": 2, "M1": 3, "M2": 4}).fillna(-1).astype(np.int8)

    # ── Card-level velocity (card1 as customer proxy) ─────────────────────
    # Number of transactions by same card1 value — card1 is the most
    # reliable customer proxy in IEEE-CIS (card number hash).
    card1_counts = df.groupby("card1")["TransactionID"].transform("count").fillna(1)
    feats["card1_tx_count"] = np.log1p(card1_counts).astype(np.float32)

    # ── Identity features (when join succeeded) ──────────────────────────
    for id_col in ["id_01", "id_02", "id_03", "id_04", "id_05", "id_06",
                   "id_09", "id_10", "id_11", "id_17", "id_19", "id_20"]:
        if id_col in df.columns:
            feats[id_col] = df[id_col].fillna(-1).astype(np.float32)

    if "DeviceType" in df.columns:
        feats["device_type_enc"] = (
            df["DeviceType"].fillna("unknown").str.lower()
            .map(_DEVICE_TYPE_MAP).fillna(-1).astype(np.int8)
        )
        feats["has_device"] = df["DeviceType"].notna().astype(np.int8)

    # ── V-columns (when present) ─────────────────────────────────────────
    for v in V_COLS_SUBSET:
        if v in df.columns:
            feats[v] = df[v].fillna(-1).astype(np.float32)

    # ── Build matrix ──────────────────────────────────────────────────────
    feature_names = list(feats.keys())
    X = np.column_stack([feats[f].values for f in feature_names]).astype(np.float32)

    # Scale continuous features
    if fit_scaler:
        scaler = StandardScaler()
        X = scaler.fit_transform(X)
    elif scaler is not None:
        X = scaler.transform(X)

    return X, feature_names, scaler


# ─────────────────────────────────────────────────────────────────────────
# Temporal split
# ─────────────────────────────────────────────────────────────────────────

def temporal_split(df: pd.DataFrame, labels: pd.Series):
    """70/15/15 temporal split on TransactionDT."""
    order = df["TransactionDT"].rank(method="first").astype(int) - 1
    n = len(df)
    train_end = int(n * 0.70)
    val_end   = int(n * 0.85)

    sorted_idx = df["TransactionDT"].argsort().values
    train_idx  = sorted_idx[:train_end]
    val_idx    = sorted_idx[train_end:val_end]
    test_idx   = sorted_idx[val_end:]

    log.info(
        "Temporal split: train=%d  val=%d  test=%d",
        len(train_idx), len(val_idx), len(test_idx),
    )
    log.info(
        "Fraud rates — train: %.4f  val: %.4f  test: %.4f",
        labels.iloc[train_idx].mean(),
        labels.iloc[val_idx].mean(),
        labels.iloc[test_idx].mean(),
    )
    return train_idx, val_idx, test_idx


# ─────────────────────────────────────────────────────────────────────────
# Threshold optimisation
# ─────────────────────────────────────────────────────────────────────────

def optimise_threshold(y_true, probs, fp_cost, fn_cost):
    """Sweep thresholds 0.01–0.99, return the one minimising expected loss."""
    best_thresh = 0.5
    best_loss   = float("inf")
    best_metrics = {}

    thresholds = np.arange(0.01, 0.995, 0.005)
    curve = []

    for t in thresholds:
        preds = (probs >= t).astype(int)
        tp = int(((preds == 1) & (y_true == 1)).sum())
        fp = int(((preds == 1) & (y_true == 0)).sum())
        tn = int(((preds == 0) & (y_true == 0)).sum())
        fn = int(((preds == 0) & (y_true == 1)).sum())
        loss = fp * fp_cost + fn * fn_cost
        prec = tp / (tp + fp + 1e-9)
        rec  = tp / (tp + fn + 1e-9)
        f1   = 2 * prec * rec / (prec + rec + 1e-9)
        curve.append({"threshold": round(float(t), 4), "expected_loss": round(float(loss), 2),
                       "precision": round(float(prec), 4), "recall": round(float(rec), 4)})
        if loss < best_loss:
            best_loss = loss
            best_thresh = float(t)
            best_metrics = {"tp": tp, "fp": fp, "tn": tn, "fn": fn,
                            "precision": prec, "recall": rec, "f1": f1, "expected_loss": loss}

    return best_thresh, best_metrics, curve


def evaluate_at_threshold(y_true, probs, threshold, fp_cost, fn_cost, split_name=""):
    preds = (probs >= threshold).astype(int)
    tp = int(((preds == 1) & (y_true == 1)).sum())
    fp = int(((preds == 1) & (y_true == 0)).sum())
    tn = int(((preds == 0) & (y_true == 0)).sum())
    fn = int(((preds == 0) & (y_true == 1)).sum())
    prec = tp / (tp + fp + 1e-9)
    rec  = tp / (tp + fn + 1e-9)
    f1   = 2 * prec * rec / (prec + rec + 1e-9)
    fpr  = fp / (fp + tn + 1e-9)
    auprc   = float(average_precision_score(y_true, probs))
    roc_auc = float(roc_auc_score(y_true, probs))
    loss = fp * fp_cost + fn * fn_cost

    label = f"[{split_name}] " if split_name else ""
    log.info(
        "%sP=%.4f R=%.4f F1=%.4f AUPRC=%.4f ROC=%.4f FPR=%.4f TP=%d FP=%d TN=%d FN=%d ExpLoss=$%.0f (thr=%.3f)",
        label, prec, rec, f1, auprc, roc_auc, fpr,
        tp, fp, tn, fn, loss, threshold,
    )
    return {
        "precision": prec, "recall": rec, "f1": f1,
        "auprc": auprc, "roc_auc": roc_auc, "fpr": fpr,
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "expected_loss": loss,
    }


# ─────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────

def run(args: argparse.Namespace) -> None:
    output_dir = Path(args.output_dir or ROOT / "data" / "artifacts" / "xgboost")
    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)

    use_v_cols = not args.fast

    # ── MLflow setup — use absolute local path to avoid /C:/ bug ─────────
    mlruns_dir = ROOT / "mlruns"
    mlruns_dir.mkdir(exist_ok=True)
    mlflow_uri = mlruns_dir.as_uri()          # file:///absolute/path  on Linux
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("zeno-ieee-cis")

    # ── Step 1: Load ──────────────────────────────────────────────────────
    log.info("=" * 60)
    log.info("STEP 1 — Load IEEE-CIS data")
    df, labels = load_data(max_rows=args.max_rows, use_v_cols=use_v_cols)

    # ── Step 2: Temporal split ────────────────────────────────────────────
    log.info("STEP 2 — Temporal split (70/15/15)")
    train_idx, val_idx, test_idx = temporal_split(df, labels)

    df_train = df.iloc[train_idx].reset_index(drop=True)
    df_val   = df.iloc[val_idx].reset_index(drop=True)
    df_test  = df.iloc[test_idx].reset_index(drop=True)
    y_train  = labels.iloc[train_idx].values.astype(np.int8)
    y_val    = labels.iloc[val_idx].values.astype(np.int8)
    y_test   = labels.iloc[test_idx].values.astype(np.int8)

    # ── Step 3: Feature engineering ───────────────────────────────────────
    log.info("STEP 3 — Feature engineering")
    t0 = time.time()
    X_train, feature_names, scaler = engineer_features(df_train, fit_scaler=True)
    X_val,   _,             _      = engineer_features(df_val,   scaler=scaler)
    X_test,  _,             _      = engineer_features(df_test,  scaler=scaler)
    log.info(
        "Features ready: train=%s  val=%s  test=%s  (%.1fs)",
        X_train.shape, X_val.shape, X_test.shape, time.time() - t0,
    )

    n_pos = int(y_train.sum())
    n_neg = int((y_train == 0).sum())
    spw   = n_neg / max(n_pos, 1)
    log.info("Train class balance: %d fraud / %d legit  scale_pos_weight=%.2f", n_pos, n_neg, spw)

    # ── Step 4: Train XGBoost ─────────────────────────────────────────────
    log.info("STEP 4 — Train XGBoost (this takes a few minutes)…")

    xgb_params = {
        "objective":          "binary:logistic",
        "eval_metric":        "aucpr",
        "max_depth":          6,
        "learning_rate":      0.1,      # higher than generic pipeline — real data trains faster
        "n_estimators":       300,
        "subsample":          0.8,
        "colsample_bytree":   0.8,
        "min_child_weight":   10,       # higher = more conservative, less overfit on small fraud class
        "reg_alpha":          0.1,
        "reg_lambda":         1.0,
        "scale_pos_weight":   spw,
        "random_state":       42,
        "n_jobs":             -1,
        "tree_method":        "hist",
        "early_stopping_rounds": 20,
    }

    t0 = time.time()
    model = xgb.XGBClassifier(**{k: v for k, v in xgb_params.items()
                                  if k != "early_stopping_rounds"},
                               early_stopping_rounds=20)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=20,
    )
    best_iter = getattr(model, "best_iteration", xgb_params["n_estimators"])
    log.info("XGBoost training done in %.1fs. Best iteration: %d", time.time() - t0, best_iter)

    # ── Step 5: Validation metrics + threshold optimisation ───────────────
    log.info("STEP 5 — Threshold optimisation on validation data")
    val_probs = model.predict_proba(X_val)[:, 1]
    best_threshold, val_best_metrics, threshold_curve = optimise_threshold(
        y_val, val_probs, args.fp_cost, args.fn_cost
    )
    log.info(
        "Optimal threshold: %.4f  P=%.4f  R=%.4f  F1=%.4f  ExpLoss=$%.0f",
        best_threshold,
        val_best_metrics["precision"], val_best_metrics["recall"],
        val_best_metrics["f1"], val_best_metrics["expected_loss"],
    )
    val_full = evaluate_at_threshold(y_val, val_probs, best_threshold, args.fp_cost, args.fn_cost, "val")

    # ── Step 6: TEST evaluation (once, frozen threshold) ──────────────────
    log.info("STEP 6 — Held-out TEST evaluation (threshold frozen from val)")
    test_probs = model.predict_proba(X_test)[:, 1]
    test_metrics = evaluate_at_threshold(y_test, test_probs, best_threshold, args.fp_cost, args.fn_cost, "TEST")

    # ── Step 7: Save artefacts ────────────────────────────────────────────
    log.info("STEP 7 — Saving artefacts to %s", output_dir)

    # XGBoost model
    model_path = output_dir / "xgb_model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    # Scaler
    scaler_path = output_dir / "scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    # Metadata — compatible with ModelRegistry / FastAPI service
    metadata = {
        "model_version":   "xgboost-ieee-cis-v1",
        "algorithm":       "XGBoost",
        "feature_version": "ieee-cis-1.0",
        "threshold":       best_threshold,
        "feature_names":   feature_names,
        "hyperparameters": xgb_params,
        "dataset":         "ieee-cis-fraud-detection",
        "n_train":         len(X_train),
        "n_val":           len(X_val),
        "n_test":          len(X_test),
        "train_fraud_rate": float(y_train.mean()),
        "test_fraud_rate":  float(y_test.mean()),
        "val_metrics":     val_full,
        "test_metrics":    test_metrics,
        "fp_cost":         args.fp_cost,
        "fn_cost":         args.fn_cost,
        "best_iteration":  best_iter,
    }
    meta_path = output_dir / "metadata.pkl"
    with open(meta_path, "wb") as f:
        pickle.dump(metadata, f)

    # Threshold curve (for frontend charts)
    curve_path = output_dir / "threshold_curve.json"
    curve_path.write_text(json.dumps(threshold_curve, indent=2), encoding="utf-8")

    # Also retrain isolation forest on the new features
    log.info("STEP 7b — Retraining Isolation Forest on new features")
    from sklearn.ensemble import IsolationForest
    iso = IsolationForest(
        n_estimators=100,
        contamination=float(y_train.mean()),
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_train)
    iso_path = output_dir / "isolation_forest.pkl"
    with open(iso_path, "wb") as f:
        pickle.dump(iso, f)
    log.info("Isolation Forest saved.")

    # ── Step 8: MLflow logging ────────────────────────────────────────────
    log.info("STEP 8 — Logging to MLflow at %s", mlflow_uri)
    try:
        with mlflow.start_run(run_name="xgboost-ieee-cis"):
            mlflow.log_params({
                "dataset":          "ieee-cis-fraud-detection",
                "max_rows":         args.max_rows or "all",
                "use_v_cols":       use_v_cols,
                "n_features":       len(feature_names),
                "n_train":          len(X_train),
                "n_val":            len(X_val),
                "n_test":           len(X_test),
                "train_fraud_rate": round(float(y_train.mean()), 6),
                "threshold":        round(best_threshold, 4),
                "fp_cost":          args.fp_cost,
                "fn_cost":          args.fn_cost,
                "best_iteration":   best_iter,
            })
            mlflow.log_metrics({
                "val_auprc":        round(val_full["auprc"], 4),
                "val_precision":    round(val_full["precision"], 4),
                "val_recall":       round(val_full["recall"], 4),
                "val_f1":           round(val_full["f1"], 4),
                "val_roc_auc":      round(val_full["roc_auc"], 4),
                "val_fpr":          round(val_full["fpr"], 4),
                "val_expected_loss": round(val_full["expected_loss"], 2),
                "test_auprc":       round(test_metrics["auprc"], 4),
                "test_precision":   round(test_metrics["precision"], 4),
                "test_recall":      round(test_metrics["recall"], 4),
                "test_f1":          round(test_metrics["f1"], 4),
                "test_roc_auc":     round(test_metrics["roc_auc"], 4),
                "test_fpr":         round(test_metrics["fpr"], 4),
                "test_expected_loss": round(test_metrics["expected_loss"], 2),
            })
            mlflow.log_artifact(str(meta_path),  artifact_path="model")
            mlflow.log_artifact(str(curve_path), artifact_path="evaluation")
        log.info("MLflow run logged successfully.")
    except Exception as exc:
        log.warning("MLflow logging failed (non-fatal): %s", exc)

    # ── Final report ──────────────────────────────────────────────────────
    _print_report(metadata, val_full, test_metrics, best_threshold, output_dir)


def _print_report(meta, val, test, threshold, output_dir):
    sep = "=" * 62
    print(f"\n{sep}")
    print("  ZENO FRAUD DETECTION — IEEE-CIS TRAINING COMPLETE")
    print(sep)
    print(f"  Dataset      : ieee-cis-fraud-detection")
    print(f"  Train rows   : {meta['n_train']:,}   ({meta['train_fraud_rate']:.2%} fraud)")
    print(f"  Test rows    : {meta['n_test']:,}    ({meta['test_fraud_rate']:.2%} fraud)")
    print(f"  Features     : {len(meta['feature_names'])}")
    print(f"  Threshold    : {threshold:.4f}  (minimises expected loss on val)")
    print(f"  FP cost      : ${meta['fp_cost']:.0f}   FN cost: ${meta['fn_cost']:.0f}")
    print()
    print(f"  {'Metric':<22} {'Validation':>12} {'Test (frozen)':>14}")
    print(f"  {'-'*50}")
    for k, label in [("auprc","AUPRC (primary)"), ("precision","Precision"),
                      ("recall","Recall"), ("f1","F1"),
                      ("roc_auc","ROC-AUC"), ("fpr","FPR")]:
        print(f"  {label:<22} {val[k]:>12.4f} {test[k]:>14.4f}")
    print(f"  {'Expected Loss':<22} ${val['expected_loss']:>11,.0f} ${test['expected_loss']:>13,.0f}")
    print(f"  {'TP/FP/TN/FN':<22} "
          f"{val['tp']}/{val['fp']}/{val['tn']}/{val['fn']:>3}  "
          f"{test['tp']}/{test['fp']}/{test['tn']}/{test['fn']}")
    print()
    print(f"  Artefacts saved to: {output_dir}")
    print(sep)
    print()


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="IEEE-CIS optimised XGBoost training")
    p.add_argument("--max-rows",   type=int,   default=150000)
    p.add_argument("--fast",       action="store_true",
                   help="Skip V-columns (faster, lower AUPRC)")
    p.add_argument("--fp-cost",    type=float, default=40.0)
    p.add_argument("--fn-cost",    type=float, default=200.0)
    p.add_argument("--output-dir", type=str,   default=None)
    return p.parse_args()


if __name__ == "__main__":
    run(_parse_args())
