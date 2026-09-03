package com.niro.modules.intelligence.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.niro.config.NiroProperties;
import com.niro.modules.intelligence.application.AiAssessment;
import com.niro.modules.intelligence.application.EvidenceBundle;
import com.niro.modules.intelligence.application.IntelligenceProvider;
import com.niro.modules.intelligence.domain.AssessmentType;
import com.niro.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiIntelligenceProvider implements IntelligenceProvider {

    private final NiroProperties properties;
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
        return """
                You are a defensive risk analyst assistant for a merchant fraud detection system.
                Analyze the following evidence and provide a structured assessment.
                
                IMPORTANT CONSTRAINTS:
                - You are interpreting evidence, NOT making final fraud determinations
                - Never claim certainty — use probabilistic language
                - Your output will be reviewed by a human analyst before any action
                - All data is synthetic and used for defensive evaluation only
                
                EVIDENCE:
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
                
                Respond ONLY with valid JSON in this exact format:
                {
                  "assessment": "POTENTIAL_COORDINATED_REFUND_ABUSE|POTENTIAL_VELOCITY_ABUSE|POTENTIAL_DEVICE_SHARING|POTENTIAL_ACCOUNT_FARMING|NORMAL_BEHAVIOR|INCONCLUSIVE",
                  "confidence": 0.0-1.0,
                  "reasons": ["reason 1", "reason 2", "reason 3"],
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
                evidence.getSignalExplanations());
    }

    private String callApi(String prompt) {
        WebClient client = WebClient.builder()
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
                "max_tokens", 500
        );

        try {
            Map<?, ?> response = client.post()
                    .uri(properties.getAi().getApiUrl())
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) throw new ExternalServiceException("OpenAI", "Empty response");

            // Extract content from choices[0].message.content
            var choices = (List<?>) response.get("choices");
            var first = (Map<?, ?>) choices.get(0);
            var message = (Map<?, ?>) first.get("message");
            return (String) message.get("content");
        } catch (WebClientResponseException ex) {
            throw new ExternalServiceException("OpenAI", "API error: " + ex.getStatusCode());
        }
    }

    private AiAssessment parseResponse(String jsonContent, EvidenceBundle evidence) {
        try {
            JsonNode node = objectMapper.readTree(jsonContent.trim());
            AssessmentType type = AssessmentType.valueOf(
                    node.get("assessment").asText("INCONCLUSIVE"));
            double confidence = node.get("confidence").asDouble(0.5);
            List<String> reasons = new ArrayList<>();
            node.get("reasons").forEach(r -> reasons.add(r.asText()));
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
