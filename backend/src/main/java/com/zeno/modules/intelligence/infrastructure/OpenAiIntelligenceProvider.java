package com.zeno.modules.intelligence.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.intelligence.application.AiAssessment;
import com.zeno.modules.intelligence.application.EvidenceBundle;
import com.zeno.modules.intelligence.application.IntelligenceProvider;
import com.zeno.modules.intelligence.domain.AssessmentType;
import com.zeno.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiIntelligenceProvider implements IntelligenceProvider {

    private final ZenoProperties properties;
    private final ObjectMapper objectMapper;

    @Override
    public boolean isAvailable() {
        return properties.getAi().isEnabled() &&
               properties.getAi().getApiKey() != null &&
               !properties.getAi().getApiKey().isBlank() &&
               !properties.getAi().getApiKey().equals("placeholder");
    }

    @Override
    public AiAssessment assess(EvidenceBundle evidence) {
        if (!isAvailable()) {
            return fallbackAssessment(evidence);
        }

        String prompt = buildPrompt(evidence);
        try {
            String response = callApi(prompt);
            return parseResponse(response, evidence);
        } catch (Exception ex) {
            log.warn("AI assessment failed, using rule-based fallback: {}", ex.getMessage());
            return fallbackAssessment(evidence);
        }
    }

    private String buildPrompt(EvidenceBundle evidence) {
        // Build ML evidence section conditionally — do not claim ML data is available if it isn't
        String mlSection;
        if (evidence.getFraudProbability() != null) {
            String shap = (evidence.getShapContributions() != null && !evidence.getShapContributions().isEmpty())
                    ? String.join(", ", evidence.getShapContributions())
                    : "not available";
            mlSection = """
                ML MODEL EVIDENCE [MODEL ESTIMATE — XGBoost + Isolation Forest]:
                - Fraud Probability: %.4f (calibrated, threshold: use as continuous signal)
                - Anomaly Score: %.4f (0=normal, 1=highly anomalous — Isolation Forest)
                - Model Version: %s
                - Top SHAP Contributors: %s
                NOTE: ML scores are MODEL ESTIMATES. They reflect learned patterns, not ground truth.
                """.formatted(
                    evidence.getFraudProbability(),
                    evidence.getAnomalyScore() != null ? evidence.getAnomalyScore() : 0.0,
                    evidence.getModelVersion() != null ? evidence.getModelVersion() : "unknown",
                    shap);
        } else {
            mlSection = "ML MODEL EVIDENCE: Not available (ML service disabled or unavailable).";
        }

        return """
                You are a defensive risk analyst assistant for a merchant fraud detection system.
                Analyze the following evidence and provide a structured assessment.

                STRICT CONSTRAINTS:
                - You are INTERPRETING evidence supplied below. You are NOT making final fraud determinations.
                - Never claim certainty — use probabilistic language.
                - Use ONLY the evidence supplied. Do NOT invent transaction data, customer history,
                  model results, or relationships not present in this bundle.
                - If a field says "not available", state that it is unavailable — do not estimate it.
                - Your output will be reviewed by a human analyst before any action is taken.
                - All data is synthetic and used for defensive evaluation only.

                RULE-BASED SIGNALS:
                - Subject: %s (ID: %s)
                - Risk Score: %d/100 (%s)
                - Triggered Signals: %s
                - Refund Rate: %.1f%% (merchant baseline: %.1f%%)
                - Transaction Count: %d | Refund Count: %d
                - Shared Device Customers: %d
                - Shared IP Customers: %d
                - Transactions in last 24h: %d
                - Cluster Size: %d
                - Signal Explanations: %s

                %s

                Respond ONLY with valid JSON in this exact format — no prose, no markdown:
                {
                  "riskSummary": "2-3 sentence summary using only supplied evidence",
                  "strongestEvidence": ["evidence item 1", "evidence item 2"],
                  "contradictingEvidence": ["any evidence that argues against fraud, or 'none observed'"],
                  "uncertainty": ["what is unknown or ambiguous"],
                  "assessment": "POTENTIAL_COORDINATED_REFUND_ABUSE|POTENTIAL_VELOCITY_ABUSE|POTENTIAL_DEVICE_SHARING|POTENTIAL_ACCOUNT_FARMING|NORMAL_BEHAVIOR|INCONCLUSIVE",
                  "confidence": 0.0,
                  "recommendedAction": "ALLOW|MONITOR|MANUAL_REVIEW|HOLD|ESCALATE"
                }
                """.formatted(
                evidence.getSubjectType(), evidence.getSubjectId(),
                evidence.getRiskScore(), evidence.getRiskLevel(),
                evidence.getTriggeredSignals(),
                evidence.getRefundRate() * 100, evidence.getMerchantBaselineRefundRate() * 100,
                evidence.getTransactionCount(), evidence.getRefundCount(),
                evidence.getSharedDeviceCount(), evidence.getSharedIpCount(),
                evidence.getVelocityLast24h(), evidence.getClusterSize(),
                evidence.getSignalExplanations(),
                mlSection);
    }

    private String callApi(String prompt) {
        RestClient client = RestClient.builder()
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getAi().getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        Map<String, Object> body = Map.of(
                "model", properties.getAi().getModel(),
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "You are a defensive risk analysis assistant. Respond only with valid JSON."),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.2,
                "max_tokens", 800
        );

        try {
            Map<?, ?> response = client.post()
                    .uri(properties.getAi().getApiUrl())
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) throw new ExternalServiceException("OpenAI", "Empty response");

            // Extract content from choices[0].message.content
            var choices = (List<?>) response.get("choices");
            var first = (Map<?, ?>) choices.get(0);
            var message = (Map<?, ?>) first.get("message");
            return (String) message.get("content");
        } catch (RestClientResponseException ex) {
            throw new ExternalServiceException("OpenAI", "API error: " + ex.getStatusCode());
        }
    }

    private AiAssessment parseResponse(String jsonContent, EvidenceBundle evidence) {
        try {
            JsonNode node = objectMapper.readTree(jsonContent.trim());
            AssessmentType type = AssessmentType.valueOf(
                    node.get("assessment").asText("INCONCLUSIVE"));
            double confidence = node.get("confidence").asDouble(0.5);

            // Accept both new structured format and legacy "reasons" array
            List<String> reasons = new ArrayList<>();
            JsonNode strongestNode = node.get("strongestEvidence");
            JsonNode reasonsNode   = node.get("reasons");
            if (strongestNode != null && strongestNode.isArray()) {
                strongestNode.forEach(r -> reasons.add(r.asText()));
                // Append uncertainty notes if present
                JsonNode uncertaintyNode = node.get("uncertainty");
                if (uncertaintyNode != null && uncertaintyNode.isArray()) {
                    uncertaintyNode.forEach(u -> reasons.add("Uncertainty: " + u.asText()));
                }
            } else if (reasonsNode != null && reasonsNode.isArray()) {
                reasonsNode.forEach(r -> reasons.add(r.asText()));
            }

            String action = node.get("recommendedAction").asText("MANUAL_REVIEW");
            return new AiAssessment(type, confidence, reasons, action, "openai");
        } catch (Exception ex) {
            log.warn("Failed to parse AI response, using fallback: {}", ex.getMessage());
            return fallbackAssessment(evidence);
        }
    }

    /**
     * Rule-based fallback when AI is disabled or unavailable.
     * Produces deterministic assessments from the evidence signals.
     * This ensures the system always returns an assessment.
     */
    private AiAssessment fallbackAssessment(EvidenceBundle evidence) {
        AssessmentType type;
        String action;
        List<String> reasons = new ArrayList<>();

        if (evidence.getSharedDeviceCount() >= 3 || evidence.getClusterSize() >= 3) {
            type = AssessmentType.POTENTIAL_COORDINATED_REFUND_ABUSE;
            action = "ESCALATE";
            reasons.add("Multiple customers sharing the same device fingerprint suggests coordinated activity");
            reasons.add("Cluster membership with " + evidence.getClusterSize() + " entities increases suspicion");
        } else if (evidence.getRefundRate() > 0.5) {
            type = AssessmentType.POTENTIAL_COORDINATED_REFUND_ABUSE;
            action = "MANUAL_REVIEW";
            reasons.add(String.format("Refund rate of %.0f%% is significantly above the merchant baseline of %.0f%%",
                    evidence.getRefundRate() * 100, evidence.getMerchantBaselineRefundRate() * 100));
        } else if (evidence.getVelocityLast24h() >= 10) {
            type = AssessmentType.POTENTIAL_VELOCITY_ABUSE;
            action = "MANUAL_REVIEW";
            reasons.add(evidence.getVelocityLast24h() + " transactions in 24 hours exceeds expected behaviour");
        } else if (evidence.getRiskScore() >= 70) {
            type = AssessmentType.INCONCLUSIVE;
            action = "MANUAL_REVIEW";
            reasons.add("Elevated risk score (" + evidence.getRiskScore() + "/100) warrants analyst review");
            reasons.addAll(evidence.getSignalExplanations().stream().limit(2).toList());
        } else {
            type = AssessmentType.NORMAL_BEHAVIOR;
            action = "ALLOW";
            reasons.add("No significant abuse patterns detected in current evidence");
        }

        double confidence = Math.min(0.95, evidence.getRiskScore() / 100.0 + 0.3);
        return new AiAssessment(type, confidence, reasons, action, "rule-based-fallback");
    }
}
