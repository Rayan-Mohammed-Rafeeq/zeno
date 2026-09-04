package com.niro.modules.monitoring;

import com.niro.modules.monitoring.interfaces.dto.MonitoringHealthResponse;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for MonitoringHealthResponse factory methods.
 *
 * Verifies that:
 *  - unavailable() correctly sets UNAVAILABLE status
 *  - fromMlResponse() correctly maps Python ML service response fields
 *  - disclaimer is always populated
 */
class MonitoringHealthResponseTest {

    @Test
    void unavailable_sets_correct_status() {
        var resp = MonitoringHealthResponse.unavailable(false);
        assertThat(resp.overallStatus()).isEqualTo("UNAVAILABLE");
        assertThat(resp.mlServiceEnabled()).isFalse();
        assertThat(resp.mlServiceReachable()).isFalse();
    }

    @Test
    void unavailable_with_enabled_but_unreachable() {
        var resp = MonitoringHealthResponse.unavailable(true);
        assertThat(resp.overallStatus()).isEqualTo("UNAVAILABLE");
        assertThat(resp.mlServiceEnabled()).isTrue();
        assertThat(resp.mlServiceReachable()).isFalse();
    }

    @Test
    void disclaimer_always_present_on_unavailable() {
        var resp = MonitoringHealthResponse.unavailable(false);
        assertThat(resp.disclaimer()).isNotBlank();
    }

    @Test
    void from_ml_response_maps_overall_status() {
        Map<String, Object> mlResp = buildMlResponse("HEALTHY");
        var resp = MonitoringHealthResponse.fromMlResponse(mlResp, true);
        assertThat(resp.overallStatus()).isEqualTo("HEALTHY");
    }

    @Test
    void from_ml_response_maps_degraded_status() {
        Map<String, Object> mlResp = buildMlResponse("DEGRADED");
        var resp = MonitoringHealthResponse.fromMlResponse(mlResp, true);
        assertThat(resp.overallStatus()).isEqualTo("DEGRADED");
    }

    @Test
    void from_ml_response_maps_model_version() {
        Map<String, Object> mlResp = buildMlResponse("HEALTHY");
        mlResp.put("model_version", "xgboost-v1");
        mlResp.put("feature_version", "1.0");
        var resp = MonitoringHealthResponse.fromMlResponse(mlResp, true);
        assertThat(resp.modelVersion()).isEqualTo("xgboost-v1");
        assertThat(resp.featureVersion()).isEqualTo("1.0");
    }

    @Test
    void from_ml_response_maps_n_recent_predictions() {
        Map<String, Object> mlResp = buildMlResponse("HEALTHY");
        mlResp.put("n_recent_predictions", 42);
        var resp = MonitoringHealthResponse.fromMlResponse(mlResp, true);
        assertThat(resp.nRecentPredictions()).isEqualTo(42);
    }

    @Test
    void from_ml_response_maps_prediction_distribution() {
        Map<String, Object> mlResp = buildMlResponse("HEALTHY");
        Map<String, Object> dist = new HashMap<>();
        dist.put("mean", 0.12);
        dist.put("std",  0.05);
        dist.put("high_risk_frac", 0.08);
        dist.put("drift_level", "LOW");
        mlResp.put("prediction_distribution", dist);

        var resp = MonitoringHealthResponse.fromMlResponse(mlResp, true);
        assertThat(resp.predMean()).isCloseTo(0.12, within(1e-6));
        assertThat(resp.predStd()).isCloseTo(0.05, within(1e-6));
        assertThat(resp.highRiskFraction()).isCloseTo(0.08, within(1e-6));
        assertThat(resp.predictionDriftLevel()).isEqualTo("LOW");
    }

    @Test
    void from_ml_response_marks_service_reachable() {
        var resp = MonitoringHealthResponse.fromMlResponse(buildMlResponse("HEALTHY"), true);
        assertThat(resp.mlServiceEnabled()).isTrue();
        assertThat(resp.mlServiceReachable()).isTrue();
    }

    @Test
    void disclaimer_always_present_on_from_ml_response() {
        var resp = MonitoringHealthResponse.fromMlResponse(buildMlResponse("HEALTHY"), true);
        assertThat(resp.disclaimer()).isNotBlank();
        assertThat(resp.disclaimer()).contains("monitoring");
    }

    private Map<String, Object> buildMlResponse(String status) {
        Map<String, Object> m = new HashMap<>();
        m.put("overall_status", status);
        m.put("model_status",   "READY");
        m.put("n_recent_predictions", 0);
        m.put("data_quality",  "GOOD");
        m.put("feature_drift", "UNKNOWN");
        m.put("prediction_distribution", Map.of(
                "mean", 0.0, "std", 0.0,
                "high_risk_frac", 0.0,
                "drift_level", "UNKNOWN"
        ));
        return m;
    }
}
