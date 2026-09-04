package com.zeno.modules.evaluation;

import com.zeno.modules.evaluation.application.ConfusionMatrix;
import com.zeno.modules.evaluation.application.EvaluationMetrics;
import com.zeno.modules.evaluation.application.MetricsCalculator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for MetricsCalculator.
 *
 * Verifies the evaluation metric formulas against known confusion matrix values.
 * These are the metrics shown on the Evaluation dashboard page — they must be
 * mathematically correct, not fabricated.
 */
class EvaluationMetricsTest {

    private final MetricsCalculator calculator = new MetricsCalculator();

    // ── Perfect classifier ─────────────────────────────────────────────────

    @Test
    void perfect_classifier_precision_is_one() {
        // TP=10, TN=90, FP=0, FN=0
        var m = calculator.compute(new ConfusionMatrix(10, 90, 0, 0));
        assertThat(m.precision()).isEqualTo(1.0);
    }

    @Test
    void perfect_classifier_recall_is_one() {
        var m = calculator.compute(new ConfusionMatrix(10, 90, 0, 0));
        assertThat(m.recall()).isEqualTo(1.0);
    }

    @Test
    void perfect_classifier_f1_is_one() {
        var m = calculator.compute(new ConfusionMatrix(10, 90, 0, 0));
        assertThat(m.f1()).isEqualTo(1.0);
    }

    @Test
    void perfect_classifier_fpr_is_zero() {
        var m = calculator.compute(new ConfusionMatrix(10, 90, 0, 0));
        assertThat(m.falsePositiveRate()).isEqualTo(0.0);
    }

    // ── Known confusion matrix ─────────────────────────────────────────────

    @Test
    void precision_formula_correct() {
        // TP=3, TN=5, FP=2, FN=1  →  precision = 3/(3+2) = 0.6
        var m = calculator.compute(new ConfusionMatrix(3, 5, 2, 1));
        assertThat(m.precision()).isCloseTo(0.6, within(0.001));
    }

    @Test
    void recall_formula_correct() {
        // TP=3, FN=1  →  recall = 3/(3+1) = 0.75
        var m = calculator.compute(new ConfusionMatrix(3, 5, 2, 1));
        assertThat(m.recall()).isCloseTo(0.75, within(0.001));
    }

    @Test
    void f1_formula_correct() {
        // P=0.6, R=0.75  →  F1 = 2 * 0.6 * 0.75 / (0.6 + 0.75) ≈ 0.6667
        var m = calculator.compute(new ConfusionMatrix(3, 5, 2, 1));
        assertThat(m.f1()).isCloseTo(2.0 * 0.6 * 0.75 / (0.6 + 0.75), within(0.001));
    }

    @Test
    void fpr_formula_correct() {
        // FP=2, TN=5  →  FPR = 2/(2+5) ≈ 0.2857
        var m = calculator.compute(new ConfusionMatrix(3, 5, 2, 1));
        assertThat(m.falsePositiveRate()).isCloseTo(2.0 / 7.0, within(0.001));
    }

    // ── Edge cases ─────────────────────────────────────────────────────────

    @Test
    void zero_tp_fp_precision_is_zero() {
        // Nothing predicted positive → precision = 0/0 → defined as 0.0
        var m = calculator.compute(new ConfusionMatrix(0, 10, 0, 5));
        assertThat(m.precision()).isEqualTo(0.0);
    }

    @Test
    void zero_positive_recall_is_zero() {
        // No actual positives → recall = 0/0 → defined as 0.0
        var m = calculator.compute(new ConfusionMatrix(0, 10, 3, 0));
        assertThat(m.recall()).isEqualTo(0.0);
    }

    @Test
    void zero_negative_fpr_is_zero() {
        // No actual negatives → FPR = 0/0 → defined as 0.0
        var m = calculator.compute(new ConfusionMatrix(5, 0, 0, 2));
        assertThat(m.falsePositiveRate()).isEqualTo(0.0);
    }

    @Test
    void all_fp_precision_is_zero() {
        // Everything flagged but none are real fraud
        var m = calculator.compute(new ConfusionMatrix(0, 0, 100, 50));
        assertThat(m.precision()).isEqualTo(0.0);
        assertThat(m.recall()).isEqualTo(0.0);
    }

    // ── Rounding ───────────────────────────────────────────────────────────

    @Test
    void metrics_rounded_to_four_decimal_places() {
        var m = calculator.compute(new ConfusionMatrix(1, 7, 1, 2));
        // precision = 1/2 = 0.5 exactly
        // recall = 1/3 ≈ 0.3333
        assertThat(String.valueOf(m.recall())).matches("0\\.333[34]");
    }

    // ── FalseNegativeRate ──────────────────────────────────────────────────

    @Test
    void fnr_is_complement_of_recall() {
        // FNR = 1 - Recall (within rounding)
        var m = calculator.compute(new ConfusionMatrix(3, 5, 2, 1));
        assertThat(m.falseNegativeRate()).isCloseTo(1.0 - m.recall(), within(0.001));
    }
}
