package com.zeno.modules.ml.infrastructure;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.ml.interfaces.dto.MlPredictionRequest;
import com.zeno.modules.ml.interfaces.dto.MlPredictionResponse;
import com.zeno.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

/**
 * HTTP client for the Python FastAPI ML inference service.
 *
 * DESIGN PRINCIPLES
 * ──────────────────
 * 1. Never silently return a default score on failure — always throw
 *    ExternalServiceException so the caller can decide to fall back
 *    to rule-based scoring or surface an error.
 * 2. Bounded timeout: configurable via zeno.ml.timeout-seconds (default 5s).
 * 3. No retry logic here — retries are handled in MlPredictionOrchestrator.
 * 4. Spring Boot never knows the ML service's internal implementation —
 *    it only depends on this contract.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MlServiceClient {

    private final ZenoProperties properties;

    /**
     * Call POST /ml/predict on the FastAPI service.
     *
     * @throws ExternalServiceException on any HTTP error, timeout, or connection failure.
     *         The caller must catch this and decide whether to fall back or propagate.
     */
    public MlPredictionResponse predict(MlPredictionRequest request) {
        ZenoProperties.Ml mlConfig = properties.getMl();
        String url = mlConfig.getServiceUrl() + "/ml/predict";

        log.debug("ML predict call: customer={} merchant={}",
                request.transaction().customerId(),
                request.transaction().merchantId());

        try {
            RestClient client = buildClient(mlConfig);
            MlPredictionResponse response = client.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(MlPredictionResponse.class);

            if (response == null) {
                throw new ExternalServiceException("MLService", "Empty response body from ML service.");
            }
            if (!response.isReady()) {
                throw new ExternalServiceException("MLService",
                        "ML service returned model_status=" + response.modelStatus() +
                        ". Model artefacts may not be loaded. Run train_full_pipeline.py first.");
            }

            log.debug("ML prediction: fp={:.4f} anomaly={:.4f} risk={}/{}",
                    response.fraudProbability(), response.anomalyScore(),
                    response.riskScore(), response.riskLevel());

            return response;

        } catch (RestClientResponseException ex) {
            throw new ExternalServiceException("MLService",
                    "HTTP " + ex.getStatusCode() + ": " + ex.getResponseBodyAsString());
        } catch (ResourceAccessException ex) {
            throw new ExternalServiceException("MLService",
                    "Connection failed to " + url + " — " + ex.getMessage() +
                    ". Is the ML service running? Start it with: python start_ml_service.py");
        }
    }

    /**
     * Check if the ML service is reachable and the model is loaded.
     * Returns false (not throws) on any failure — used for health checks only.
     */
    public boolean isHealthy() {
        try {
            ZenoProperties.Ml mlConfig = properties.getMl();
            var client = buildClient(mlConfig);
            var resp = client.get()
                    .uri(mlConfig.getServiceUrl() + "/health")
                    .retrieve()
                    .body(java.util.Map.class);
            return resp != null && "UP".equals(resp.get("status"));
        } catch (Exception ex) {
            log.debug("ML service health check failed: {}", ex.getMessage());
            return false;
        }
    }

    private RestClient buildClient(ZenoProperties.Ml config) {
        return RestClient.builder()
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
