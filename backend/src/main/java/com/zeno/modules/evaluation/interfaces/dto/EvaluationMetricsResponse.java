package com.zeno.modules.evaluation.interfaces.dto;

import com.zeno.modules.evaluation.domain.EvaluationRun;

import java.time.Instant;

/**
 * Flat metrics response matching the shape expected by the frontend
 * evaluationApi.getMetrics() call at GET /evaluation/metrics.
 *
 * All metric values are MODEL ESTIMATES from synthetic data.
 * The disclaimer field is always populated.
 */
public record EvaluationMetricsResponse(
        int datasetSize,
        int positiveCases,
        int negativeCases,
        int truePositives,
        int trueNegatives,
        int falsePositives,
        int falseNegatives,
        double precision,
        double recall,
        double f1Score,
        double falsePositiveRate,
        double falsePositiveCost,
        String lastEvaluationAt,
        String disclaimer
) {
    private static final String DISCLAIMER =
            "All metrics are computed from synthetic data using a prototype detector. " +
            "They do not represent production fraud detection performance.";

    public static EvaluationMetricsResponse from(EvaluationRun run, double fpCostPerCase) {
        int positiveCases = run.getTruePositive() + run.getFalseNegative();
        int negativeCases = run.getTrueNegative() + run.getFalsePositive();

        return new EvaluationMetricsResponse(
                run.getSampleCount(),
                positiveCases,
                negativeCases,
                run.getTruePositive(),
                run.getTrueNegative(),
                run.getFalsePositive(),
                run.getFalseNegative(),
                nvl(run.getPrecisionScore()),
                nvl(run.getRecallScore()),
                nvl(run.getF1Score()),
                nvl(run.getFalsePositiveRate()),
                nvl(run.getFalsePositiveCost()),
                run.getEvaluatedAt() != null ? run.getEvaluatedAt().toString() : null,
                DISCLAIMER
        );
    }

    private static double nvl(Double v) {
        return v != null ? v : 0.0;
    }
}
