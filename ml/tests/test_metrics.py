"""
Tests for evaluation metrics and threshold sweep.

Verifies:
  - Precision/recall/F1 against known confusion matrix values
  - AUPRC and ROC-AUC on controlled probability distributions
  - Expected loss formula: FN × fn_cost + FP × fp_cost
  - Edge cases: all-correct, all-wrong, degenerate labels
  - Threshold sweep identifies minimum-loss point
  - Curve data helpers return correct shapes
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from zeno_ml.evaluation.metrics import (
    DEFAULT_FP_COST,
    DEFAULT_FN_COST,
    EvaluationMetrics,
    evaluate,
    precision_recall_curve_data,
    roc_curve_data,
    sweep_thresholds,
)


# ── Shared fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def perfect_predictions():
    """Labels and probabilities where the model is perfect."""
    y_true = np.array([0, 0, 0, 1, 1, 1], dtype=bool)
    y_prob = np.array([0.05, 0.1, 0.15, 0.85, 0.9, 0.95])
    return y_true, y_prob


@pytest.fixture
def known_confusion_matrix():
    """
    Manually constructed confusion matrix:
      TP=3, TN=5, FP=2, FN=1   at threshold=0.5
      Precision = 3/5 = 0.6
      Recall    = 3/4 = 0.75
      F1        = 2 * 0.6 * 0.75 / (0.6 + 0.75) = 0.6667
      FPR       = 2/7 = 0.2857
    """
    y_true = np.array([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], dtype=bool)
    y_prob = np.array([0.9, 0.8, 0.7, 0.3, 0.95, 0.85, 0.1, 0.05, 0.02, 0.01, 0.01])
    #                  TP   TP   TP   FN   FP    FP    TN   TN    TN    TN    TN
    return y_true, y_prob


@pytest.fixture
def imbalanced_predictions():
    """5% fraud rate — representative of real fraud data."""
    rng = np.random.default_rng(0)
    n = 1000
    y_true = (rng.random(n) < 0.05).astype(bool)
    # Good detector: high prob for fraud, low for legit
    y_prob = np.where(y_true, rng.beta(8, 2, n), rng.beta(2, 8, n))
    return y_true, y_prob


# ── Precision / Recall / F1 ────────────────────────────────────────────────

class TestClassificationMetrics:

    def test_perfect_classifier_metrics(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.precision == pytest.approx(1.0)
        assert m.recall    == pytest.approx(1.0)
        assert m.f1        == pytest.approx(1.0)
        assert m.fpr       == pytest.approx(0.0)
        assert m.false_positives == 0
        assert m.false_negatives == 0

    def test_known_confusion_matrix_precision(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        # TP=3, FP=2 → precision = 3/5 = 0.6
        assert m.precision == pytest.approx(0.6, abs=0.001)

    def test_known_confusion_matrix_recall(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        # TP=3, FN=1 → recall = 3/4 = 0.75
        assert m.recall == pytest.approx(0.75, abs=0.001)

    def test_known_confusion_matrix_f1(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        # F1 = 2 * 0.6 * 0.75 / (0.6 + 0.75)
        expected_f1 = 2 * 0.6 * 0.75 / (0.6 + 0.75)
        assert m.f1 == pytest.approx(expected_f1, abs=0.001)

    def test_known_confusion_matrix_fpr(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        # FP=2, TN=5 → FPR = 2/7
        assert m.fpr == pytest.approx(2 / 7, abs=0.001)

    def test_confusion_matrix_counts_correct(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.true_positives  == 3
        assert m.false_positives == 2
        assert m.true_negatives  == 5
        assert m.false_negatives == 1
        # Totals must sum to n
        assert (m.true_positives + m.true_negatives +
                m.false_positives + m.false_negatives) == len(y_true)

    def test_threshold_above_all_probs_gives_zero_precision(self):
        """When threshold > max(prob), no positives predicted → precision=0."""
        y_true = np.array([1, 1, 0, 0], dtype=bool)
        y_prob = np.array([0.8, 0.7, 0.2, 0.1])
        m = evaluate(y_true, y_prob, threshold=0.99)
        assert m.true_positives  == 0
        assert m.false_positives == 0
        # precision = 0/0 → safe_div returns 0.0
        assert m.precision == 0.0

    def test_threshold_below_all_probs_gives_recall_one(self):
        """When threshold near 0, everything flagged → recall=1, FPR=1."""
        y_true = np.array([1, 1, 0, 0, 0], dtype=bool)
        y_prob = np.array([0.8, 0.7, 0.6, 0.5, 0.4])
        m = evaluate(y_true, y_prob, threshold=0.01)
        assert m.recall == pytest.approx(1.0)
        assert m.fpr    == pytest.approx(1.0)

    def test_n_samples_and_fraud_rate(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.n_samples  == len(y_true)
        assert m.n_positive == int(y_true.sum())
        assert m.n_negative == len(y_true) - int(y_true.sum())
        assert m.fraud_rate == pytest.approx(y_true.mean(), rel=1e-4)


# ── AUPRC / ROC-AUC ───────────────────────────────────────────────────────

class TestProbabilisticMetrics:

    def test_perfect_auprc(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.auprc == pytest.approx(1.0, abs=0.01)

    def test_perfect_roc_auc(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.roc_auc == pytest.approx(1.0, abs=0.01)

    def test_random_classifier_roc_auc_near_half(self):
        """A random classifier should have ROC-AUC ≈ 0.5."""
        rng = np.random.default_rng(99)
        y_true = (rng.random(500) < 0.1).astype(bool)
        y_prob = rng.random(500)
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert 0.35 < m.roc_auc < 0.65, (
            f"Random classifier ROC-AUC={m.roc_auc:.3f} unexpectedly far from 0.5"
        )

    def test_auprc_above_fraud_rate(self, imbalanced_predictions):
        """
        A good detector's AUPRC should be well above the random baseline
        (which equals the fraud rate for AUPRC).
        """
        y_true, y_prob = imbalanced_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        fraud_rate = y_true.mean()
        assert m.auprc > fraud_rate * 3, (
            f"AUPRC={m.auprc:.4f} should be >> random baseline {fraud_rate:.4f}"
        )

    def test_metrics_threshold_independent(self, perfect_predictions):
        """AUPRC and ROC-AUC must not change when threshold changes."""
        y_true, y_prob = perfect_predictions
        m1 = evaluate(y_true, y_prob, threshold=0.3)
        m2 = evaluate(y_true, y_prob, threshold=0.7)
        assert m1.auprc   == pytest.approx(m2.auprc,   abs=1e-6)
        assert m1.roc_auc == pytest.approx(m2.roc_auc, abs=1e-6)


# ── Expected loss ─────────────────────────────────────────────────────────

class TestExpectedLoss:

    def test_expected_loss_formula(self, known_confusion_matrix):
        """Expected loss = FN × fn_cost + FP × fp_cost."""
        y_true, y_prob = known_confusion_matrix
        fp_cost = 50.0
        fn_cost = 300.0
        m = evaluate(y_true, y_prob, threshold=0.5, fp_cost=fp_cost, fn_cost=fn_cost)
        # FP=2, FN=1
        expected = 1 * fn_cost + 2 * fp_cost
        assert m.expected_loss == pytest.approx(expected, abs=0.01)

    def test_perfect_classifier_zero_loss(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.expected_loss == 0.0

    def test_loss_increases_with_missed_fraud(self):
        """Increasing fn_cost must increase expected_loss when FN > 0."""
        y_true = np.array([1, 1, 0], dtype=bool)
        y_prob = np.array([0.3, 0.3, 0.9])   # both fraud missed, one FP
        m_low  = evaluate(y_true, y_prob, threshold=0.5, fn_cost=10.0,  fp_cost=10.0)
        m_high = evaluate(y_true, y_prob, threshold=0.5, fn_cost=1000.0, fp_cost=10.0)
        assert m_high.expected_loss > m_low.expected_loss

    def test_cost_params_stored_in_metrics(self, known_confusion_matrix):
        y_true, y_prob = known_confusion_matrix
        m = evaluate(y_true, y_prob, threshold=0.5, fp_cost=77.0, fn_cost=333.0)
        assert m.fp_cost == 77.0
        assert m.fn_cost == 333.0


# ── Edge cases ────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_all_negative_labels(self):
        """All-negative ground truth: recall and FNR undefined → 0.0."""
        y_true = np.zeros(10, dtype=bool)
        y_prob = np.linspace(0.1, 0.9, 10)
        # Should not raise
        m = evaluate(y_true, y_prob, threshold=0.5)
        assert m.n_positive == 0
        assert m.recall == 0.0

    def test_empty_arrays_raise(self):
        with pytest.raises(ValueError, match="empty"):
            evaluate(np.array([], dtype=bool), np.array([]))

    def test_length_mismatch_raises(self):
        with pytest.raises(ValueError, match="length"):
            evaluate(np.array([True, False]), np.array([0.5]))

    def test_split_name_stored(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5, split_name="test")
        assert m.split_name == "test"

    def test_summary_dict_keys(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        m = evaluate(y_true, y_prob, threshold=0.5)
        d = m.summary_dict()
        for key in ["precision", "recall", "f1", "auprc", "roc_auc", "fpr",
                    "expected_loss", "threshold", "n_samples"]:
            assert key in d, f"Missing key '{key}' in summary_dict"


# ── Threshold sweep ────────────────────────────────────────────────────────

class TestThresholdSweep:

    def test_optimal_threshold_minimises_loss(self, imbalanced_predictions):
        y_true, y_prob = imbalanced_predictions
        sweep = sweep_thresholds(y_true, y_prob, fp_cost=40.0, fn_cost=200.0)
        opt = sweep.optimal_point
        all_losses = [p.expected_loss for p in sweep.points]
        assert opt.expected_loss == min(all_losses), (
            "Optimal point does not have the minimum expected loss."
        )

    def test_sweep_covers_full_range(self, imbalanced_predictions):
        y_true, y_prob = imbalanced_predictions
        sweep = sweep_thresholds(y_true, y_prob, n_thresholds=100)
        thresholds = [p.threshold for p in sweep.points]
        assert min(thresholds) < 0.05
        assert max(thresholds) > 0.95

    def test_sweep_returns_correct_count(self, imbalanced_predictions):
        y_true, y_prob = imbalanced_predictions
        sweep = sweep_thresholds(y_true, y_prob, n_thresholds=50)
        assert len(sweep.points) == 50

    def test_optimal_threshold_stored(self, imbalanced_predictions):
        y_true, y_prob = imbalanced_predictions
        sweep = sweep_thresholds(y_true, y_prob)
        assert sweep.optimal_threshold == sweep.optimal_point.threshold

    def test_high_fn_cost_favours_low_threshold(self, imbalanced_predictions):
        """
        When fn_cost >> fp_cost, the optimal threshold should be LOW
        (catch more fraud at expense of FPs).
        When fp_cost >> fn_cost, optimal threshold should be HIGH.
        """
        y_true, y_prob = imbalanced_predictions
        sweep_fn = sweep_thresholds(y_true, y_prob, fp_cost=1.0,   fn_cost=10000.0)
        sweep_fp = sweep_thresholds(y_true, y_prob, fp_cost=10000.0, fn_cost=1.0)
        assert sweep_fn.optimal_threshold < sweep_fp.optimal_threshold, (
            "High fn_cost should produce a lower threshold than high fp_cost."
        )

    def test_to_records_serialisable(self, imbalanced_predictions):
        """to_records() must return JSON-serialisable dicts."""
        import json
        y_true, y_prob = imbalanced_predictions
        sweep = sweep_thresholds(y_true, y_prob, n_thresholds=10)
        records = sweep.to_records()
        json.dumps(records)   # must not raise


# ── Curve data helpers ────────────────────────────────────────────────────

class TestCurveData:

    def test_pr_curve_keys(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        data = precision_recall_curve_data(y_true, y_prob)
        assert "precision" in data
        assert "recall"    in data
        assert "thresholds" in data

    def test_roc_curve_keys(self, perfect_predictions):
        y_true, y_prob = perfect_predictions
        data = roc_curve_data(y_true, y_prob)
        assert "fpr" in data
        assert "tpr" in data
        assert "thresholds" in data

    def test_pr_curve_values_in_range(self, imbalanced_predictions):
        y_true, y_prob = imbalanced_predictions
        data = precision_recall_curve_data(y_true, y_prob)
        assert all(0 <= v <= 1 for v in data["precision"])
        assert all(0 <= v <= 1 for v in data["recall"])
