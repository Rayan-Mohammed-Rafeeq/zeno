"""
Cost-sensitive threshold optimization.

This module implements the full threshold optimization workflow described
in the master spec, Section 19:

  For thresholds across a range, calculate TP, FP, TN, FN, Precision,
  Recall, F1, FPR, Expected Loss.  Select the optimal operating threshold
  using validation data.  Freeze the threshold.  Then evaluate once on
  the held-out test set.

The sweep_thresholds() function in metrics.py handles the numerical
computation.  This module adds:

  1. ThresholdOptimizer — convenience class that wraps sweep + selection
     with merchant-configurable costs.
  2. Threshold curve data for the frontend charts:
     - threshold vs precision
     - threshold vs recall
     - threshold vs F1
     - threshold vs expected loss
  3. Comparison table across multiple threshold candidates.
  4. Business impact estimation (clearly labeled as MODEL ESTIMATE).

BUSINESS IMPACT METHODOLOGY
─────────────────────────────
Expected savings = FN_cost × (TP / (TP + FN)) × total_fraud_value

where:
  TP / (TP + FN) = recall at the selected threshold
  total_fraud_value = estimated using fraud rate × n_transactions × avg_amount

This is labeled MODEL ESTIMATE and BUSINESS ASSUMPTION throughout.
Real savings depend on analyst follow-through and fraud patterns
that differ from the training distribution.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from zeno_ml.evaluation.metrics import (
    EvaluationMetrics,
    ThresholdSweepResult,
    evaluate,
    sweep_thresholds,
)

logger = logging.getLogger(__name__)


@dataclass
class ThresholdOptimizationResult:
    """
    Complete result of threshold optimization on validation data.

    All fields are computed from actual model outputs.
    Business impact figures are clearly labeled as estimates.
    """
    # Selected threshold
    optimal_threshold:   float
    selection_criterion: str   # e.g. "minimum expected_loss"

    # Metrics at optimal threshold on VALIDATION data
    val_metrics:         EvaluationMetrics

    # Full sweep results (for charts)
    sweep:               ThresholdSweepResult

    # Cost assumptions used
    fp_cost:             float
    fn_cost:             float

    # Business impact estimate (MODEL ESTIMATE + BUSINESS ASSUMPTION)
    estimated_fraud_exposure:  float   # total fraud value in validation set
    estimated_fraud_detected:  float   # fraud_exposure × recall
    estimated_fp_cost_total:   float   # fp_count × fp_cost
    estimated_net_loss_avoided: float  # detected - fp_cost

    # Metadata
    n_val_samples:       int
    val_fraud_rate:      float

    def summary(self) -> str:
        return (
            f"Threshold: {self.optimal_threshold:.4f}  "
            f"Criterion: {self.selection_criterion}\n"
            f"Validation: P={self.val_metrics.precision:.4f} "
            f"R={self.val_metrics.recall:.4f} "
            f"F1={self.val_metrics.f1:.4f} "
            f"AUPRC={self.val_metrics.auprc:.4f}\n"
            f"Expected Loss: ${self.val_metrics.expected_loss:,.0f}  "
            f"[MODEL ESTIMATE]\n"
            f"Est. Fraud Detected: ${self.estimated_fraud_detected:,.0f}  "
            f"[MODEL ESTIMATE + BUSINESS ASSUMPTION]"
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "optimal_threshold":        round(self.optimal_threshold, 4),
            "selection_criterion":      self.selection_criterion,
            "fp_cost":                  self.fp_cost,
            "fn_cost":                  self.fn_cost,
            "validation_metrics":       self.val_metrics.summary_dict(),
            "business_impact": {
                "label":                    "MODEL ESTIMATE + BUSINESS ASSUMPTION",
                "estimated_fraud_exposure": round(self.estimated_fraud_exposure, 2),
                "estimated_fraud_detected": round(self.estimated_fraud_detected, 2),
                "estimated_fp_cost_total":  round(self.estimated_fp_cost_total, 2),
                "estimated_net_loss_avoided": round(self.estimated_net_loss_avoided, 2),
                "note": (
                    "These are model-derived estimates based on configurable cost assumptions. "
                    "They are NOT observed savings. Real outcomes depend on analyst follow-through "
                    "and fraud patterns not present in the training distribution."
                ),
            },
            "threshold_curves": self.sweep.to_records(),
        }


class ThresholdOptimizer:
    """
    Selects the optimal decision threshold on validation data.

    Never touches the test set.  The selected threshold is intended
    to be frozen and evaluated exactly once on the held-out test set.
    """

    def __init__(
        self,
        fp_cost: float = 40.0,
        fn_cost: float = 200.0,
        avg_transaction_amount: float = 150.0,   # BUSINESS ASSUMPTION default
    ) -> None:
        self.fp_cost                 = fp_cost
        self.fn_cost                 = fn_cost
        self.avg_transaction_amount  = avg_transaction_amount

    def optimize(
        self,
        y_val:       np.ndarray,
        val_probs:   np.ndarray,
        n_thresholds: int = 200,
    ) -> ThresholdOptimizationResult:
        """
        Run threshold sweep on validation data and select the optimal threshold.

        Parameters
        ----------
        y_val      : validation ground truth labels
        val_probs  : validation predicted probabilities
        n_thresholds : number of threshold points to evaluate

        Returns
        -------
        ThresholdOptimizationResult
        """
        y_val     = np.asarray(y_val,     dtype=bool)
        val_probs = np.asarray(val_probs, dtype=float)

        sweep = sweep_thresholds(
            y_val, val_probs,
            fp_cost=self.fp_cost,
            fn_cost=self.fn_cost,
            n_thresholds=n_thresholds,
        )

        opt = sweep.optimal_threshold
        val_metrics = evaluate(
            y_val, val_probs,
            threshold=opt,
            fp_cost=self.fp_cost,
            fn_cost=self.fn_cost,
            split_name="validation",
        )

        # Business impact estimate — clearly labeled
        n           = len(y_val)
        n_fraud     = int(y_val.sum())
        fraud_rate  = n_fraud / n if n > 0 else 0.0
        exposure    = n_fraud * self.avg_transaction_amount   # BUSINESS ASSUMPTION
        detected    = exposure * val_metrics.recall            # MODEL ESTIMATE
        fp_cost_tot = val_metrics.false_positives * self.fp_cost
        net_avoided = detected - fp_cost_tot

        logger.info(
            "Threshold optimized: threshold=%.4f P=%.4f R=%.4f F1=%.4f "
            "ExpLoss=$%.0f (fp_cost=%.0f fn_cost=%.0f)",
            opt,
            val_metrics.precision, val_metrics.recall, val_metrics.f1,
            val_metrics.expected_loss, self.fp_cost, self.fn_cost,
        )

        return ThresholdOptimizationResult(
            optimal_threshold        = opt,
            selection_criterion      = "minimum expected_loss on validation data",
            val_metrics              = val_metrics,
            sweep                    = sweep,
            fp_cost                  = self.fp_cost,
            fn_cost                  = self.fn_cost,
            estimated_fraud_exposure = exposure,
            estimated_fraud_detected = detected,
            estimated_fp_cost_total  = fp_cost_tot,
            estimated_net_loss_avoided = net_avoided,
            n_val_samples            = n,
            val_fraud_rate           = fraud_rate,
        )
