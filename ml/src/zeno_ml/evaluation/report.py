"""
Benchmark report generator.

Produces machine-readable (JSON) and human-readable (text) benchmark
reports from evaluation results.

CONTRACT
────────
• All numbers in the report come from actual experiment results.
• No field is ever hardcoded or estimated.
• The report clearly distinguishes:
    MODEL ESTIMATE  — quantities produced by the ML pipeline
    BUSINESS ASSUMPTION — cost figures and threshold choices
• Synthetic data results are labelled as such.
• The report includes the test_fingerprint from the temporal split so the
  test set can be verified to be the same across runs.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from zeno_ml.evaluation.metrics import EvaluationMetrics

logger = logging.getLogger(__name__)


@dataclass
class ModelEntry:
    """Metadata and metrics for one model in a comparison table."""
    name:              str
    algorithm:         str
    feature_version:   str
    feature_groups:    list[str]
    hyperparameters:   dict[str, Any]
    threshold:         float
    val_metrics:       EvaluationMetrics
    test_metrics:      EvaluationMetrics | None = None
    notes:             str = ""


@dataclass
class BenchmarkReport:
    """
    Complete benchmark report.  All fields must be populated from actual
    experiment results before calling to_json() or to_text().
    """
    # ── Dataset metadata ──────────────────────────────────────────────────
    dataset_name:       str = ""
    dataset_version:    str = ""
    dataset_source:     str = ""     # e.g. "IEEE-CIS" or "SYNTHETIC"
    is_synthetic:       bool = False
    n_train:            int  = 0
    n_val:              int  = 0
    n_test:             int  = 0
    train_fraud_rate:   float = 0.0
    val_fraud_rate:     float = 0.0
    test_fraud_rate:    float = 0.0
    order_column:       str  = ""
    test_fingerprint:   str  = ""

    # ── Models ────────────────────────────────────────────────────────────
    models:             list[ModelEntry] = field(default_factory=list)

    # ── Cost assumptions ─────────────────────────────────────────────────
    fp_cost:            float = 40.0
    fn_cost:            float = 200.0

    # ── Ablation ──────────────────────────────────────────────────────────
    ablation_results:   list[dict[str, Any]] = field(default_factory=list)

    # ── Metadata ──────────────────────────────────────────────────────────
    generated_at:       str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    zeno_version:       str = "0.1.0"

    # ─────────────────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a dict suitable for JSON output."""
        return {
            "generated_at":   self.generated_at,
            "zeno_version":   self.zeno_version,
            "dataset": {
                "name":           self.dataset_name,
                "version":        self.dataset_version,
                "source":         self.dataset_source,
                "is_synthetic":   self.is_synthetic,
                "n_train":        self.n_train,
                "n_val":          self.n_val,
                "n_test":         self.n_test,
                "train_fraud_rate": round(self.train_fraud_rate, 6),
                "val_fraud_rate":   round(self.val_fraud_rate,   6),
                "test_fraud_rate":  round(self.test_fraud_rate,  6),
                "order_column":     self.order_column,
                "test_fingerprint": self.test_fingerprint,
            },
            "cost_assumptions": {
                "label":   "BUSINESS ASSUMPTION",
                "fp_cost": self.fp_cost,
                "fn_cost": self.fn_cost,
                "note":    (
                    "FP cost = manual review + opportunity cost. "
                    "FN cost = assumed average fraudulent transaction value. "
                    "These are configurable assumptions, not observed savings."
                ),
            },
            "models": [self._model_to_dict(m) for m in self.models],
            "ablation": self.ablation_results,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def to_text(self) -> str:
        """Human-readable benchmark report."""
        lines: list[str] = []
        sep = "─" * 70

        lines += [
            "╔══════════════════════════════════════════════════════════════════════╗",
            "║              ZENO FRAUD DETECTION — BENCHMARK REPORT               ║",
            "╚══════════════════════════════════════════════════════════════════════╝",
            "",
            f"Generated : {self.generated_at}",
            f"Version   : {self.zeno_version}",
        ]

        # Dataset
        lines += ["", sep, "DATASET", sep]
        if self.is_synthetic:
            lines.append("⚠  SYNTHETIC DATA — results do not represent production performance.")
        lines += [
            f"  Name          : {self.dataset_name}",
            f"  Version       : {self.dataset_version}",
            f"  Source        : {self.dataset_source}",
            f"  Split column  : {self.order_column}",
            f"",
            f"  {'Split':<12} {'Rows':>10} {'Fraud Rate':>12}",
            f"  {'─'*12} {'─'*10} {'─'*12}",
            f"  {'Train':<12} {self.n_train:>10,} {self.train_fraud_rate:>12.4%}",
            f"  {'Validation':<12} {self.n_val:>10,} {self.val_fraud_rate:>12.4%}",
            f"  {'Test':<12} {self.n_test:>10,} {self.test_fraud_rate:>12.4%}",
            f"",
            f"  Test fingerprint: {self.test_fingerprint[:32]}…",
        ]

        # Cost assumptions
        lines += [
            "", sep, "COST ASSUMPTIONS  [BUSINESS ASSUMPTION]", sep,
            f"  False positive cost : ${self.fp_cost:.2f} per case",
            f"  False negative cost : ${self.fn_cost:.2f} per case",
            f"  (Configurable assumptions — not observed merchant savings)",
        ]

        # Models
        lines += ["", sep, "MODEL RESULTS  [MODEL ESTIMATE]", sep]
        for m in self.models:
            lines += self._model_to_text_lines(m)

        # Ablation
        if self.ablation_results:
            lines += ["", sep, "ABLATION STUDY", sep]
            lines.append(
                f"  {'Model':<45} {'AUPRC':>8} {'F1':>8} {'Expected Loss':>14}"
            )
            lines.append(f"  {'─'*45} {'─'*8} {'─'*8} {'─'*14}")
            for row in self.ablation_results:
                lines.append(
                    f"  {row.get('model',''):<45} "
                    f"{row.get('val_auprc', 0.0):>8.4f} "
                    f"{row.get('val_f1', 0.0):>8.4f} "
                    f"{row.get('val_expected_loss', 0.0):>14.0f}"
                )

        lines += ["", sep, "END OF REPORT", sep, ""]
        return "\n".join(lines)

    def save(self, output_dir: Path | str) -> tuple[Path, Path]:
        """
        Save both JSON and text report to output_dir.
        Returns (json_path, text_path).
        """
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        json_path = out / f"benchmark_{ts}.json"
        text_path = out / f"benchmark_{ts}.txt"

        json_path.write_text(self.to_json(), encoding="utf-8")
        text_path.write_text(self.to_text(), encoding="utf-8")

        logger.info("Benchmark report saved: %s, %s", json_path, text_path)
        return json_path, text_path

    # ─────────────────────────────────────────────────────────────────────
    # Private helpers
    # ─────────────────────────────────────────────────────────────────────

    def _model_to_dict(self, m: ModelEntry) -> dict[str, Any]:
        d: dict[str, Any] = {
            "name":            m.name,
            "algorithm":       m.algorithm,
            "feature_version": m.feature_version,
            "feature_groups":  m.feature_groups,
            "hyperparameters": m.hyperparameters,
            "threshold":       round(m.threshold, 4),
            "notes":           m.notes,
            "validation":      m.val_metrics.summary_dict(),
        }
        if m.test_metrics is not None:
            d["test"] = m.test_metrics.summary_dict()
            d["test"]["label"] = "MODEL ESTIMATE on frozen held-out test set"
        return d

    def _model_to_text_lines(self, m: ModelEntry) -> list[str]:
        lines = [
            "",
            f"  ▸ {m.name}  [{m.algorithm}]",
            f"    Feature version : {m.feature_version}",
            f"    Feature groups  : {', '.join(m.feature_groups)}",
            f"    Threshold       : {m.threshold:.4f}",
        ]
        if m.notes:
            lines.append(f"    Notes           : {m.notes}")

        def metrics_block(label: str, met: EvaluationMetrics) -> list[str]:
            return [
                f"",
                f"    {label}",
                f"    {'─'*40}",
                f"    {'Precision':<20} {met.precision:.4f}",
                f"    {'Recall':<20} {met.recall:.4f}",
                f"    {'F1':<20} {met.f1:.4f}",
                f"    {'AUPRC':<20} {met.auprc:.4f}   ← primary metric",
                f"    {'ROC-AUC':<20} {met.roc_auc:.4f}",
                f"    {'FPR':<20} {met.fpr:.4f}",
                f"    {'FNR':<20} {met.fnr:.4f}",
                f"    {'TP/FP/TN/FN':<20} {met.true_positives}/{met.false_positives}/"
                f"{met.true_negatives}/{met.false_negatives}",
                f"    {'Expected Loss':<20} ${met.expected_loss:,.0f}  [MODEL ESTIMATE]",
            ]

        lines += metrics_block("Validation results", m.val_metrics)
        if m.test_metrics is not None:
            lines += metrics_block(
                "Test results  ← held-out, frozen, evaluated once", m.test_metrics
            )
        return lines
