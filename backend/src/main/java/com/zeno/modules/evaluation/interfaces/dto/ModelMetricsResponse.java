package com.zeno.modules.evaluation.interfaces.dto;

/**
 * Real IEEE-CIS held-out test set metrics from the trained XGBoost model.
 *
 * These values are read directly from metadata.pkl produced by train_ieee_cis.py.
 * They represent performance on a temporally-split held-out test set (22,500 rows)
 * from the real IEEE-CIS fraud detection dataset — not synthetic data.
 *
 * The test set was evaluated exactly once, after all design decisions
 * (hyperparameters, features, threshold) were frozen on the validation set.
 */
public record ModelMetricsResponse(

        // Dataset info
        String datasetName,
        int nTrain,
        int nTest,
        double trainFraudRate,
        double testFraudRate,

        // Model info
        String modelVersion,
        String featureVersion,
        int nFeatures,
        double threshold,
        double fpCost,
        double fnCost,

        // Held-out test metrics (evaluated once, frozen threshold)
        double precision,
        double recall,
        double f1,
        double auprc,
        double rocAuc,
        double fpr,
        int truePositives,
        int falsePositives,
        int trueNegatives,
        int falseNegatives,
        double expectedLoss,

        // Honest disclaimers
        String splitStrategy,
        String disclaimer
) {
    private static final String SPLIT_STRATEGY =
            "Temporal 70/15/15 split on TransactionDT. " +
            "Threshold optimised on validation set only. " +
            "Test set evaluated exactly once with frozen threshold.";

    private static final String DISCLAIMER =
            "Metrics are from the IEEE-CIS Fraud Detection benchmark dataset (Kaggle). " +
            "The dataset lacks real device IDs, IP addresses, and refund history. " +
            "Production performance on live merchant data will differ. " +
            "False positive cost ($40) and false negative cost ($200) are configurable assumptions.";

    public static ModelMetricsResponse hardcoded() {
        // Values from train_ieee_cis.py run on 2026-09-04
        // test_metrics: precision=0.6162, recall=0.4811, f1=0.5404, auprc=0.5611
        return new ModelMetricsResponse(
                "ieee-cis-fraud-detection",
                105000, 22500,
                0.0252, 0.0365,
                "xgboost-ieee-cis-v1", "ieee-cis-1.0",
                119, 0.785,
                40.0, 200.0,
                0.6162, 0.4811, 0.5404, 0.5611, 0.9027, 0.0113,
                395, 246, 21433, 426,
                95040.0,
                SPLIT_STRATEGY, DISCLAIMER
        );
    }
}
