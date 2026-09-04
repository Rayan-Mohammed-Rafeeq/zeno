package com.zeno.modules.evaluation;

import com.zeno.modules.evaluation.interfaces.dto.EvaluationMetricsResponse;
import com.zeno.modules.evaluation.domain.EvaluationRun;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for EvaluationMetricsResponse.from() mapping.
 *
 * Verifies that positiveCases and negativeCases are derived correctly
 * from the confusion matrix, and that the disclaimer is always present.
 */
class EvaluationMetricsResponseTest {

    @Test
    void positive_cases_equals_tp_plus_fn() {
        var run = buildRun(10, 80, 5, 5);
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        // positiveCases = TP + FN = 10 + 5 = 15
        assertThat(resp.positiveCases()).isEqualTo(15);
    }

    @Test
    void negative_cases_equals_tn_plus_fp() {
        var run = buildRun(10, 80, 5, 5);
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        // negativeCases = TN + FP = 80 + 5 = 85
        assertThat(resp.negativeCases()).isEqualTo(85);
    }

    @Test
    void dataset_size_from_sample_count() {
        var run = buildRun(10, 80, 5, 5);
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        assertThat(resp.datasetSize()).isEqualTo(100);
    }

    @Test
    void precision_recall_f1_mapped_correctly() {
        var run = buildRun(10, 80, 5, 5);
        run.setPrecisionScore(0.6667);
        run.setRecallScore(0.6667);
        run.setF1Score(0.6667);
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        assertThat(resp.precision()).isCloseTo(0.6667, within(1e-4));
        assertThat(resp.recall()).isCloseTo(0.6667, within(1e-4));
        assertThat(resp.f1Score()).isCloseTo(0.6667, within(1e-4));
    }

    @Test
    void false_positive_cost_mapped_from_run() {
        var run = buildRun(0, 90, 10, 0);
        run.setFalsePositiveCost(400.0);  // 10 FPs × $40
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        assertThat(resp.falsePositiveCost()).isEqualTo(400.0);
    }

    @Test
    void null_scores_default_to_zero() {
        var run = buildRun(5, 90, 3, 2);
        // Leave precision/recall/f1 as null (not yet computed)
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        assertThat(resp.precision()).isEqualTo(0.0);
        assertThat(resp.recall()).isEqualTo(0.0);
        assertThat(resp.f1Score()).isEqualTo(0.0);
    }

    @Test
    void disclaimer_always_present() {
        var run = buildRun(5, 90, 3, 2);
        var resp = EvaluationMetricsResponse.from(run, 40.0);
        assertThat(resp.disclaimer()).isNotBlank();
        assertThat(resp.disclaimer()).contains("synthetic");
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private EvaluationRun buildRun(int tp, int tn, int fp, int fn) {
        return EvaluationRun.builder()
                .id(UUID.randomUUID())
                .merchantId(UUID.randomUUID())
                .datasetRunId(UUID.randomUUID())
                .evaluatedAt(Instant.now())
                .sampleCount(tp + tn + fp + fn)
                .truePositive(tp)
                .trueNegative(tn)
                .falsePositive(fp)
                .falseNegative(fn)
                .falsePositiveCost(0.0)
                .build();
    }
}
