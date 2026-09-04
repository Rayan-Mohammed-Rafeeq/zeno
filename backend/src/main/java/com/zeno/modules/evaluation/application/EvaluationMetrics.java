package com.zeno.modules.evaluation.application;

/**
 * Computed evaluation metrics derived from a ConfusionMatrix.
 * All values are computed from predictions vs hidden ground truth —
 * never fabricated or estimated.
 */
public record EvaluationMetrics(
        double precision,
        double recall,
        double f1,
        double falsePositiveRate,
        double falseNegativeRate
) {}
