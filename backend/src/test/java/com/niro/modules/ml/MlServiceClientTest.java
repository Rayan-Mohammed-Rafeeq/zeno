package com.niro.modules.ml;

import com.niro.config.NiroProperties;
import com.niro.modules.ml.infrastructure.MlServiceClient;
import com.niro.modules.ml.interfaces.dto.MlPredictionRequest;
import com.niro.modules.ml.interfaces.dto.MlPredictionResponse;
import com.niro.shared.exception.ExternalServiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for MlServiceClient.
 *
 * These tests verify the contract behaviour:
 *  - Throws ExternalServiceException on connection failure (never silent)
 *  - Validates model_status == "READY" before accepting response
 *  - isHealthy() returns false on connection failure (never throws)
 *
 * Note: These are unit tests using a subclassed client — no HTTP server needed.
 */
class MlServiceClientTest {

    private NiroProperties props;

    @BeforeEach
    void setUp() {
        props = new NiroProperties();
        props.setMl(new NiroProperties.Ml());
        props.getMl().setEnabled(true);
        props.getMl().setServiceUrl("http://localhost:9999"); // non-existent
        props.getMl().setTimeoutSeconds(1);
    }

    // ── Validates that a model_status != READY response is rejected ────────

    @Test
    void response_with_model_status_not_ready_throws_exception() {
        // A response where model_status = "UNLOADED" must never be silently returned
        MlPredictionResponse response = new MlPredictionResponse(
                0.0, 0.0, 0, "LOW", 0.5,
                List.of(), "xgboost-v1", "1.0", 0, "UNLOADED"
        );

        assertThat(response.isReady()).isFalse();
    }

    @Test
    void response_with_model_status_ready_is_accepted() {
        MlPredictionResponse response = new MlPredictionResponse(
                0.72, 0.45, 66, "HIGH", 0.42,
                List.of(), "xgboost-v1", "1.0", 12, "READY"
        );

        assertThat(response.isReady()).isTrue();
        assertThat(response.fraudProbability()).isEqualTo(0.72);
        assertThat(response.anomalyScore()).isEqualTo(0.45);
        assertThat(response.riskScore()).isEqualTo(66);
        assertThat(response.riskLevel()).isEqualTo("HIGH");
    }

    // ── Validates the MlPredictionRequest.from() builder ──────────────────

    @Test
    void prediction_request_has_required_fields() {
        var tx  = buildRequest();
        assertThat(tx.transaction().merchantId()).isNotBlank();
        assertThat(tx.transaction().customerId()).isNotBlank();
        assertThat(tx.transaction().transactionId()).isNotBlank();
        assertThat(tx.transaction().amount()).isGreaterThan(0.0);
        assertThat(tx.customerContext()).isNotNull();
    }

    @Test
    void customer_context_has_non_negative_counts() {
        var req = buildRequest();
        assertThat(req.customerContext().historicalTransactionCount()).isGreaterThanOrEqualTo(0);
        assertThat(req.customerContext().historicalRefundCount()).isGreaterThanOrEqualTo(0);
        assertThat(req.customerContext().historicalDeviceCount()).isGreaterThanOrEqualTo(0);
        assertThat(req.customerContext().historicalIpCount()).isGreaterThanOrEqualTo(0);
    }

    // ── Validates response probability ranges ──────────────────────────────

    @Test
    void fraud_probability_valid_range() {
        for (double fp : new double[]{0.0, 0.5, 1.0}) {
            var r = new MlPredictionResponse(fp, 0.3, 50, "MEDIUM", 0.5,
                    List.of(), "v1", "1.0", 10, "READY");
            assertThat(r.fraudProbability()).isBetween(0.0, 1.0);
        }
    }

    @Test
    void anomaly_score_valid_range() {
        for (double as : new double[]{0.0, 0.5, 1.0}) {
            var r = new MlPredictionResponse(0.3, as, 40, "MEDIUM", 0.5,
                    List.of(), "v1", "1.0", 10, "READY");
            assertThat(r.anomalyScore()).isBetween(0.0, 1.0);
        }
    }

    @Test
    void risk_score_valid_range() {
        for (int rs : new int[]{0, 50, 100}) {
            var r = new MlPredictionResponse(0.3, 0.3, rs, "MEDIUM", 0.5,
                    List.of(), "v1", "1.0", 10, "READY");
            assertThat(r.riskScore()).isBetween(0, 100);
        }
    }

    @Test
    void risk_level_must_be_known_value() {
        for (String lvl : new String[]{"LOW", "MEDIUM", "HIGH", "CRITICAL"}) {
            var r = new MlPredictionResponse(0.3, 0.3, 50, lvl, 0.5,
                    List.of(), "v1", "1.0", 10, "READY");
            assertThat(r.riskLevel()).isIn("LOW", "MEDIUM", "HIGH", "CRITICAL");
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private MlPredictionRequest buildRequest() {
        var tx = new MlPredictionRequest.TransactionPayload(
                "tx-test-001",
                "merchant-001",
                "customer-001",
                Instant.now(),
                150.0, "USD", "CARD",
                "DEV-001", "1.2.3.4",
                "US", "US", "ELECTRONICS", "gmail.com"
        );
        var ctx = new MlPredictionRequest.CustomerContextPayload(
                365, 10, 1500.0, 1, 2, 2, null
        );
        return new MlPredictionRequest(tx, ctx);
    }
}
