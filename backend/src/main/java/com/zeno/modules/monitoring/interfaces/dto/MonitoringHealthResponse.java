package com.zeno.modules.monitoring.interfaces.dto;

/**
 * Model monitoring health response.
 *
 * All fields reflect the current operational state of the ML pipeline.
 * The disclaimer field is always populated — this is a lightweight monitoring
 * system for demonstration, not a production drift-detection guarantee.
 *
 * STATUS VALUES
 * ─────────────
 * overall_status:
 *   HEALTHY    — no significant issues detected
 *   DEGRADED   — some indicators are elevated; analyst should review
 *   CRITICAL   — significant drift or data quality issue detected
 *   UNAVAILABLE— ML service is not running or model not loaded
 *
 * Individual drift levels: LOW | MEDIUM | HIGH | UNKNOWN
 *   UNKNOWN = insufficient data to compute drift (< 30 recent predictions)
 */
public record MonitoringHealthResponse(
        String overallStatus,

        // ML service health (proxied from FastAPI /ml/monitoring/health)
        String modelStatus,
        String modelVersion,
        String featureVersion,

        // Prediction distribution
        Integer nRecentPredictions,
        Double predMean,
        Double predStd,
        Double highRiskFraction,
        String predictionDriftLevel,

        // Data quality
        String dataQuality,
        String featureDriftLevel,

        // Data source metadata
        boolean mlServiceEnabled,
        boolean mlServiceReachable,

        // Always present
        String disclaimer
) {
    private static final String DISCLAIMER =
            "This is a lightweight monitoring system for demonstration. " +
            "Drift classification uses simple statistical thresholds without p-values. " +
            "DEGRADED/CRITICAL status means distributions look different from expected — " +
            "not that the model has definitively degraded. " +
            "Production monitoring requires persistent prediction logging.";

    public static MonitoringHealthResponse unavailable(boolean mlEnabled) {
        return new MonitoringHealthResponse(
                "UNAVAILABLE", "UNLOADED", null, null,
                0, null, null, null, "UNKNOWN",
                "UNKNOWN", "UNKNOWN",
                mlEnabled, false,
                DISCLAIMER
        );
    }

    @SuppressWarnings("unchecked")
    public static MonitoringHealthResponse fromMlResponse(
            java.util.Map<String, Object> mlResp,
            boolean mlEnabled
    ) {
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> predDist = mlResp.get("prediction_distribution") instanceof java.util.Map<?,?> m
                ? (java.util.Map<String, Object>) m
                : java.util.Map.of();

        return new MonitoringHealthResponse(
                safeStr(mlResp.get("overall_status"), "UNKNOWN"),
                safeStr(mlResp.get("model_status"),   "UNLOADED"),
                mlResp.get("model_version")   instanceof String s ? s : null,
                mlResp.get("feature_version") instanceof String s ? s : null,
                mlResp.get("n_recent_predictions") instanceof Number n ? n.intValue() : 0,
                predDist.get("mean") instanceof Number m ? m.doubleValue() : null,
                predDist.get("std")  instanceof Number s ? s.doubleValue() : null,
                predDist.get("high_risk_frac") instanceof Number h ? h.doubleValue() : null,
                safeStr(predDist.get("drift_level"), "UNKNOWN"),
                safeStr(mlResp.get("data_quality"),  "UNKNOWN"),
                safeStr(mlResp.get("feature_drift"),  "UNKNOWN"),
                mlEnabled, true,
                DISCLAIMER
        );
    }

    private static String safeStr(Object val, String fallback) {
        return val instanceof String s ? s : (val != null ? val.toString() : fallback);
    }
}
