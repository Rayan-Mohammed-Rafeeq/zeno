package com.zeno.modules.ml.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response received from the Python FastAPI ML service.
 *
 * Deserialized from the JSON returned by POST /ml/predict.
 * Spring Boot must not silently treat missing fields as zeros —
 * if modelStatus is not "READY", the prediction must not be used.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MlPredictionResponse(
        @JsonProperty("fraud_probability")   double fraudProbability,
        @JsonProperty("anomaly_score")        double anomalyScore,
        @JsonProperty("risk_score")           int riskScore,
        @JsonProperty("risk_level")           String riskLevel,
        @JsonProperty("threshold")            double threshold,
        @JsonProperty("feature_contributions") List<FeatureContribution> featureContributions,
        @JsonProperty("model_version")        String modelVersion,
        @JsonProperty("feature_version")      String featureVersion,
        @JsonProperty("processing_ms")        int processingMs,
        @JsonProperty("model_status")         String modelStatus
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FeatureContribution(
            @JsonProperty("feature")    String feature,
            @JsonProperty("shap_value") double shapValue,
            @JsonProperty("direction")  String direction,
            @JsonProperty("rank")       int rank
    ) {}

    /** Returns true if the response contains valid ML prediction data. */
    public boolean isReady() {
        return "READY".equalsIgnoreCase(modelStatus);
    }
}
