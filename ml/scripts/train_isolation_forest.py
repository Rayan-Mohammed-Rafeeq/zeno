"""
Isolation Forest training script.

Trains the anomaly detector on training data only (unsupervised).
Validates score separation on the validation set.
Saves isolation_forest.pkl to the artefact directory.

Usage
─────
    python scripts/train_isolation_forest.py --synthetic --n-samples 8000
    python scripts/train_isolation_forest.py --max-rows 100000
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import pandas as pd

from niro_ml.features.base import ALL_FEATURE_COLUMNS
from niro_ml.models.isolation_forest import AnomalyDetector
from niro_ml.models.splits import temporal_split, temporal_split_labels
from niro_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("train_isolation_forest")


def train(args: argparse.Namespace) -> None:
    mlflow_uri = f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("niro-fraud-detection")

    output_dir = Path(args.output_dir or ROOT / "data" / "artifacts" / "xgboost")
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Load + split + features ───────────────────────────────────────────
    df, labels, dataset_meta = load_dataset(args)
    split = temporal_split(df, order_column="transaction_dt",
                           metadata={"dataset": dataset_meta["name"]})
    df_train, df_val, _ = split.apply(df)
    y_train_s, y_val_s, _ = temporal_split_labels(labels, split)

    X_train, y_train, scaler = build_feature_matrix(df_train, pd.Series(y_train_s), fit_scaler=True)
    X_val,   y_val,   _      = build_feature_matrix(df_val,   pd.Series(y_val_s),   scaler=scaler)
    logger.info("Feature shapes: train=%s val=%s", X_train.shape, X_val.shape)

    with mlflow.start_run(run_name="isolation-forest-v1") as run:
        logger.info("MLflow run: %s", run.info.run_id)
        mlflow.log_params({
            "algorithm":       "IsolationForest",
            "dataset":         dataset_meta["name"],
            "is_synthetic":    dataset_meta["is_synthetic"],
            "contamination":   "auto (from fraud rate)",
            "n_estimators":    200,
            "n_anomaly_features": "auto",
        })

        detector = AnomalyDetector()
        detector.fit(X_train, y_train, feature_names=ALL_FEATURE_COLUMNS)

        val_stats = detector.validate(X_val, y_val)
        mlflow.log_metrics({k: round(v, 4) for k, v in val_stats.items()})

        artefact_paths = detector.save(output_dir)
        for name, path in artefact_paths.items():
            mlflow.log_artifact(str(path), artifact_path="model")

        logger.info("Score separation (legit - fraud): %.4f", val_stats["score_separation"])
        if val_stats["score_separation"] > 0:
            logger.info("✓ Fraud transactions have lower scores (more anomalous) — expected.")
        else:
            logger.warning(
                "Score separation is negative — fraud transactions are not more anomalous "
                "than legitimate ones in this dataset. Check feature quality."
            )

    print(f"\n✓ Isolation Forest training complete.")
    print(f"  Artefact: {output_dir / 'isolation_forest.pkl'}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train Isolation Forest anomaly detector")
    p.add_argument("--synthetic",  action="store_true")
    p.add_argument("--n-samples",  type=int,   default=8000)
    p.add_argument("--max-rows",   type=int,   default=None)
    p.add_argument("--output-dir", type=str,   default=None)
    return p.parse_args()


if __name__ == "__main__":
    train(_parse_args())
