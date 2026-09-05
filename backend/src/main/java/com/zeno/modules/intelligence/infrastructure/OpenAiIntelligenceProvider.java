package com.zeno.modules.intelligence.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.intelligence.application.AiAssessment;
import com.zeno.modules.intelligence.application.EvidenceBundle;
import com.zeno.modules.intelligence.application.IntelligenceProvider;
import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
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

/**
 * OpenRouter-backed AI evidence interpreter.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. The LLM receives only observable evidence — no ground truth.
 * 2. The prompt instructs the LLM to distinguish ML predictions from
 *    rule-based signals, and to use only supplied values.
 * 3. SHAP values from ml_predictions are included when available.
 * 4. Output is required structured JSON — validated before use.
 * 5. Any parse failure returns an explicit AI failure indicator,
 *    NOT a fabricated assessment.
 * 6. The deterministic fallback always runs when AI is unavailable.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiIntelligenceProvider implements IntelligenceProvider {

    private static final String ASSESSMENT_DISCLAIMER =
            "AI-generated evidence summary. Requires analyst verification. " +
            "Does not independently establish fraud. Based on model predictions and rule-based signals only.";

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
            log.debug("AI provider not available — using deterministic fallback.");
            return deterministicFallback(evidence);
        }

        String prompt = buildPrompt(evidence);
        try {
            String jsonContent = callApi(prompt);
            return parseStructuredResponse(jsonContent, evidence);
        } catch (Exception ex) {
            log.warn("AI assessment failed ({}), using deterministic fallback: {}",
                    ex.getClass().getSimpleName(), ex.getMessage());
            return deterministicFallback(evidence);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Prompt builder
    // ─────────────────────────────────────────────────────────────────────

    private String buildPrompt(EvidenceBundle e) {
        StringBuilder sb = new StringBuilder();

        sb.append("""
                SYSTEM: You are assisting a merchant fraud-risk analyst at a payments company.
                You are NOT an autonomous decision maker. Your role is to synthesize supplied evidence
                into a structured assessment that helps a human analyst decide what to do next.

                STRICT RULES:
                - Base EVERY statement on the supplied evidence only.
                - Do NOT infer facts not present in this bundle.
                - Do NOT claim certainty. Use probabilistic language.
                - Distinguish observed rule-based signals from ML model predictions.
                - If a field is marked "not available", state that — do not estimate it.
                - Recommend defensive next steps only (MANUAL_REVIEW, MONITOR, HOLD_FOR_REVIEW, PREPARE_CHARGEBACK_EVIDENCE).
                - Your output will be reviewed by a human analyst before any action is taken.
                """);

        sb.append("\n=== SUBJECT UNDER REVIEW ===\n");
        sb.append("Subject Type: ").append(e.getSubjectType()).append("\n");
        sb.append("Subject ID: ").append(e.getSubjectId()).append("\n");
        sb.append("Merchant ID: ").append(e.getMerchantId()).append("\n");

        sb.append("\n=== RISK SCORE (RULE-BASED SIGNALS) ===\n");
        sb.append("Risk Score: ").append(e.getRiskScore()).append("/100\n");
        sb.append("Risk Level: ").append(e.getRiskLevel()).append("\n");
        sb.append("Triggered Signals: ").append(e.getTriggeredSignals()).append("\n");

        // Enriched signal details
        if (e.getSignalDetails() != null && !e.getSignalDetails().isEmpty()) {
            sb.append("\nSignal Details:\n");
            for (EvidenceBundle.SignalDetail sd : e.getSignalDetails()) {
                sb.append("  [").append(sd.getSeverity()).append("] ")
                  .append(sd.getSignalName())
                  .append(" | Observed: ").append(formatDouble(sd.getObservedValue()))
                  .append(" | Baseline: ").append(formatDouble(sd.getBaselineValue()))
                  .append(" | Score contribution: +").append(sd.getScoreContribution()).append(" pts")
                  .append("\n    Evidence: ").append(sd.getExplanation()).append("\n");
            }
        }

        sb.append("\n=== TRANSACTION BEHAVIOUR ===\n");
        sb.append("Total Transactions: ").append(e.getTransactionCount()).append("\n");
        sb.append("Total Refunds: ").append(e.getRefundCount()).append("\n");
        sb.append(String.format("Refund Rate: %.1f%%\n", e.getRefundRate() * 100));
        sb.append(String.format("Merchant Baseline Refund Rate: %.1f%%\n", e.getMerchantBaselineRefundRate() * 100));
        if (e.getRefundRate() > 0 && e.getMerchantBaselineRefundRate() > 0) {
            double ratio = e.getRefundRate() / e.getMerchantBaselineRefundRate();
            sb.append(String.format("Refund Rate vs Baseline: %.1fx\n", ratio));
        }
        sb.append("Transactions in Last 24h: ").append(e.getVelocityLast24h()).append("\n");
        sb.append("Shared Device Customers: ").append(e.getSharedDeviceCount()).append("\n");
        sb.append("Shared IP Customers: ").append(e.getSharedIpCount()).append("\n");
        if (e.getEstimatedExposure() != null) {
            sb.append("Estimated Refund Exposure: ₹").append(e.getEstimatedExposure().toPlainString()).append("\n");
        }

        // ML evidence section
        sb.append("\n=== ML MODEL EVIDENCE [MODEL ESTIMATES — NOT GROUND TRUTH] ===\n");
        if (e.getFraudProbability() != null) {
            sb.append(String.format("XGBoost Fraud Probability: %.4f (%.1f%%)\n",
                    e.getFraudProbability(), e.getFraudProbability() * 100));
            if (e.getAnomalyScore() != null) {
                sb.append(String.format("Isolation Forest Anomaly Score: %.4f (0=normal, 1=highly anomalous)\n",
                        e.getAnomalyScore()));
            }
            sb.append("Model Version: ").append(e.getModelVersion() != null ? e.getModelVersion() : "unknown").append("\n");
            sb.append("Benchmark (IEEE-CIS held-out): Precision=").append(e.getBenchmarkPrecision())
              .append(", Recall=").append(e.getBenchmarkRecall())
              .append(", AUPRC=").append(e.getBenchmarkAuprc()).append("\n");

            if (e.getShapContributions() != null && !e.getShapContributions().isEmpty()) {
                sb.append("Top SHAP Feature Contributions (positive = pushes toward fraud):\n");
                for (String shap : e.getShapContributions()) {
                    sb.append("  * ").append(shap).append("\n");
                }
            } else {
                sb.append("SHAP Contributions: not available\n");
            }
            sb.append("IMPORTANT: ML scores are model estimates trained on IEEE-CIS data. ")
              .append("They indicate learned patterns, not confirmed fraud.\n");
        } else {
            sb.append("ML service was not available during this risk analysis. ")
              .append("Assessment is based on rule-based signals only.\n");
        }

        // Network/cluster evidence
        sb.append("\n=== NETWORK / GRAPH EVIDENCE ===\n");
        if (e.getClusterSize() > 1) {
            sb.append("Cluster Detected: YES\n");
            sb.append("Cluster Size: ").append(e.getClusterSize()).append(" entities\n");
            sb.append("Connected High-Risk Entities: ").append(e.getConnectedHighRiskCount() != null
                    ? e.getConnectedHighRiskCount() : "unknown").append("\n");
            if (e.getClusterRelationshipSummary() != null) {
                sb.append("Cluster Details: ").append(e.getClusterRelationshipSummary()).append("\n");
            }
        } else {
            sb.append("Cluster Detected: NO — no connected abuse cluster found for this subject.\n");
        }

        sb.append("\n=== REQUIRED OUTPUT FORMAT ===\n");
        sb.append("Respond ONLY with this exact JSON structure — no prose, no markdown:\n");
        sb.append("""
                {
                  "assessment": "HIGH_RISK | MEDIUM_RISK | LOW_RISK | INCONCLUSIVE",
                  "confidence": 0,
                  "recommendedAction": "MANUAL_REVIEW | MONITOR | HOLD_FOR_REVIEW | PREPARE_CHARGEBACK_EVIDENCE",
                  "summary": "2-3 sentence evidence-grounded summary using only supplied data",
                  "reasons": [
                    {
                      "signal": "signal name",
                      "observed": "observed value",
                      "baseline": "expected baseline",
                      "interpretation": "what this means in context"
                    }
                  ],
                  "mlEvidence": {
                    "fraudProbability": 0.0,
                    "topShapDrivers": ["feature (+0.xx)", "feature (+0.xx)"],
                    "modelVersion": "version string or null",
                    "disclaimer": "SHAP explains model prediction not ground truth"
                  },
                  "networkEvidence": {
                    "clusterDetected": true,
                    "clusterSize": 0,
                    "relationshipSummary": "description or null"
                  },
                  "limitations": [
                    "limitation 1",
                    "limitation 2"
                  ],
                  "analystNote": "specific actionable note for the human analyst"
                }
                """);
        sb.append("confidence must be an integer 0-100. ")
          .append("reasons array must contain 2-4 entries from the most significant signals. ")
          .append("Do not invent values not present above.\n");

        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────
    // API call
    // ─────────────────────────────────────────────────────────────────────

    private String callApi(String prompt) {
        RestClient client = RestClient.builder()
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getAi().getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        Map<String, Object> body = Map.of(
                "model", properties.getAi().getModel(),
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "You are a defensive fraud-risk analyst assistant. Respond only with valid JSON " +
                                "matching the exact schema provided. Do not include markdown or prose."),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.1,
                "max_tokens", 1200
        );

        try {
            Map<?, ?> response = client.post()
                    .uri(properties.getAi().getApiUrl() + "/chat/completions")
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) throw new ExternalServiceException("OpenRouter", "Empty response");

            var choices = (List<?>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new ExternalServiceException("OpenRouter", "No choices in response");
            }
            var first   = (Map<?, ?>) choices.get(0);
            var message = (Map<?, ?>) first.get("message");
            String content = (String) message.get("content");

            // Strip any markdown code fences the model might add despite instructions
            if (content != null) {
                content = content.strip();
                if (content.startsWith("```")) {
                    content = content.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
                }
            }
            return content;
        } catch (RestClientResponseException ex) {
            throw new ExternalServiceException("OpenRouter", "HTTP " + ex.getStatusCode() +
                    ": " + ex.getResponseBodyAsString().substring(0, Math.min(200,
                            ex.getResponseBodyAsString().length())));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Parse + validate structured response
    // ─────────────────────────────────────────────────────────────────────

    private AiAssessment parseStructuredResponse(String jsonContent, EvidenceBundle evidence) {
        if (jsonContent == null || jsonContent.isBlank()) {
            log.warn("AI returned empty response — using deterministic fallback.");
            return deterministicFallback(evidence);
        }

        try {
            JsonNode node = objectMapper.readTree(jsonContent.trim());

            // ── Required fields ───────────────────────────────────────────
            String assessmentStr = node.path("assessment").asText("INCONCLUSIVE");
            int confidence       = node.path("confidence").asInt(50);
            String action        = node.path("recommendedAction").asText("MANUAL_REVIEW");
            String summary       = node.path("summary").asText("");

            // Map LLM assessment label to our AssessmentType enum
            AssessmentType assessmentType = mapAssessmentType(assessmentStr, evidence);

            // ── Reasons ───────────────────────────────────────────────────
            List<AiAssessmentEntity.StructuredResult.ReasonEntry> reasons = new ArrayList<>();
            JsonNode reasonsNode = node.path("reasons");
            if (reasonsNode.isArray()) {
                for (JsonNode r : reasonsNode) {
                    reasons.add(new AiAssessmentEntity.StructuredResult.ReasonEntry(
                            r.path("signal").asText(""),
                            r.path("observed").asText(""),
                            r.path("baseline").asText(""),
                            r.path("interpretation").asText("")
                    ));
                }
            }

            // ── ML evidence ───────────────────────────────────────────────
            AiAssessmentEntity.StructuredResult.MlEvidence mlEv = null;
            JsonNode mlNode = node.path("mlEvidence");
            if (!mlNode.isMissingNode()) {
                List<String> shapDrivers = new ArrayList<>();
                mlNode.path("topShapDrivers").forEach(n -> shapDrivers.add(n.asText()));
                mlEv = new AiAssessmentEntity.StructuredResult.MlEvidence(
                        mlNode.path("fraudProbability").isNull() ? null
                                : mlNode.path("fraudProbability").asDouble(),
                        shapDrivers,
                        mlNode.path("modelVersion").asText(null),
                        mlNode.path("disclaimer").asText(
                                "SHAP explains model prediction, not ground truth.")
                );
            }

            // ── Network evidence ──────────────────────────────────────────
            AiAssessmentEntity.StructuredResult.NetworkEvidence netEv = null;
            JsonNode netNode = node.path("networkEvidence");
            if (!netNode.isMissingNode()) {
                netEv = new AiAssessmentEntity.StructuredResult.NetworkEvidence(
                        netNode.path("clusterDetected").asBoolean(false),
                        netNode.path("clusterSize").asInt(0),
                        netNode.path("relationshipSummary").asText(null)
                );
            }

            // ── Limitations ───────────────────────────────────────────────
            List<String> limitations = new ArrayList<>();
            node.path("limitations").forEach(n -> limitations.add(n.asText()));
            if (limitations.isEmpty()) {
                limitations.add(ASSESSMENT_DISCLAIMER);
            }

            String analystNote = node.path("analystNote").asText(null);

            // ── Flat reasons for legacy field ──────────────────────────────
            List<String> flatReasons = reasons.stream()
                    .map(r -> r.getSignal() + ": " + r.getObserved() + " (baseline: " + r.getBaseline() + ") — " + r.getInterpretation())
                    .collect(java.util.stream.Collectors.toList());

            AiAssessmentEntity.StructuredResult structured = new AiAssessmentEntity.StructuredResult(
                    assessmentStr, confidence, action, summary, reasons, mlEv, netEv, limitations, analystNote, true
            );

            log.info("AI structured assessment parsed: assessment={} confidence={} action={} reasons={}",
                    assessmentStr, confidence, action, reasons.size());

            return new AiAssessment(
                    assessmentType,
                    confidence / 100.0,
                    flatReasons,
                    action,
                    "openrouter",
                    structured
            );

        } catch (Exception ex) {
            log.warn("Failed to parse AI structured response ({}): {} — using deterministic fallback.",
                    ex.getClass().getSimpleName(), ex.getMessage());
            log.debug("Raw AI response that failed to parse: {}", jsonContent);
            return deterministicFallback(evidence);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Deterministic fallback
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Rule-based fallback when AI is disabled or unavailable.
     * Produces deterministic assessments from observable evidence signals.
     * The structuredResult will have aiGenerated=false so the frontend
     * can clearly distinguish AI-generated from deterministic assessments.
     */
    private AiAssessment deterministicFallback(EvidenceBundle evidence) {
        AssessmentType type;
        String action;
        List<String> flatReasons = new ArrayList<>();
        List<AiAssessmentEntity.StructuredResult.ReasonEntry> reasonEntries = new ArrayList<>();

        // Build deterministic reasons from actual signal values
        if (evidence.getSharedDeviceCount() >= 3 || evidence.getClusterSize() >= 3) {
            type = AssessmentType.POTENTIAL_DEVICE_SHARING;
            action = "MANUAL_REVIEW";
            addReason(reasonEntries, flatReasons,
                    "Device / network clustering",
                    String.valueOf(Math.max(evidence.getSharedDeviceCount(), evidence.getClusterSize())),
                    "< 2",
                    "Multiple accounts sharing the same device or forming a connected cluster — consistent with coordinated activity.");
        } else if (evidence.getRefundRate() > 0.3) {
            type = AssessmentType.POTENTIAL_COORDINATED_REFUND_ABUSE;
            action = "MANUAL_REVIEW";
            addReason(reasonEntries, flatReasons,
                    "Refund rate",
                    String.format("%.1f%%", evidence.getRefundRate() * 100),
                    String.format("%.1f%%", evidence.getMerchantBaselineRefundRate() * 100),
                    "Refund rate significantly exceeds merchant baseline. Elevated refund patterns are a primary indicator of refund abuse.");
        } else if (evidence.getVelocityLast24h() >= 10) {
            type = AssessmentType.POTENTIAL_VELOCITY_ABUSE;
            action = "MONITOR";
            addReason(reasonEntries, flatReasons,
                    "Transaction velocity (24h)",
                    String.valueOf(evidence.getVelocityLast24h()),
                    "< 10",
                    "High transaction velocity in a 24-hour window is consistent with velocity abuse or automated activity.");
        } else if (evidence.getRiskScore() >= 70) {
            type = AssessmentType.INCONCLUSIVE;
            action = "MANUAL_REVIEW";
            addReason(reasonEntries, flatReasons,
                    "Composite risk score",
                    String.valueOf(evidence.getRiskScore()) + "/100",
                    "< 70",
                    "Elevated composite risk score — multiple lower-severity signals combine to indicate review is warranted.");
            evidence.getSignalExplanations().stream().limit(2).forEach(exp ->
                    addReason(reasonEntries, flatReasons, "Supporting signal", "present", "absent", exp));
        } else {
            type = AssessmentType.NORMAL_BEHAVIOR;
            action = "MONITOR";
            addReason(reasonEntries, flatReasons,
                    "Overall evidence",
                    "No significant abuse pattern",
                    "Normal",
                    "No significant abuse patterns detected in current observable evidence.");
        }

        // Include ML if available
        AiAssessmentEntity.StructuredResult.MlEvidence mlEv = null;
        if (evidence.getFraudProbability() != null) {
            mlEv = new AiAssessmentEntity.StructuredResult.MlEvidence(
                    evidence.getFraudProbability(),
                    evidence.getShapContributions() != null ? evidence.getShapContributions() : List.of(),
                    evidence.getModelVersion(),
                    "SHAP explains model prediction, not ground truth."
            );
            addReason(reasonEntries, flatReasons,
                    "ML fraud probability",
                    String.format("%.1f%%", evidence.getFraudProbability() * 100),
                    "< threshold",
                    "XGBoost model estimate — not ground truth. Trained on IEEE-CIS benchmark data.");
        }

        // Network evidence
        AiAssessmentEntity.StructuredResult.NetworkEvidence netEv =
                new AiAssessmentEntity.StructuredResult.NetworkEvidence(
                        evidence.getClusterSize() > 1,
                        evidence.getClusterSize(),
                        evidence.getClusterRelationshipSummary()
                );

        List<String> limitations = List.of(
                "Deterministic fallback — AI service was unavailable or disabled.",
                "Assessment is based on rule-based signals only. ML and LLM interpretation are unavailable.",
                "Analyst verification required before any action is taken."
        );

        double confidence = Math.min(0.90, evidence.getRiskScore() / 100.0 + 0.25);

        AiAssessmentEntity.StructuredResult structured = new AiAssessmentEntity.StructuredResult(
                type.name(), (int)(confidence * 100), action,
                "Deterministic risk assessment based on rule-based signals. " +
                "AI interpretation was not available.",
                reasonEntries, mlEv, netEv, limitations,
                "Review the risk signals listed above. AI assessment unavailable — rely on rule-based evidence.",
                false   // not AI-generated
        );

        return new AiAssessment(type, confidence, flatReasons, action, "rule-based-fallback", structured);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private static void addReason(
            List<AiAssessmentEntity.StructuredResult.ReasonEntry> entries,
            List<String> flat,
            String signal, String observed, String baseline, String interpretation) {
        entries.add(new AiAssessmentEntity.StructuredResult.ReasonEntry(signal, observed, baseline, interpretation));
        flat.add(signal + ": " + observed + " (baseline: " + baseline + ") — " + interpretation);
    }

    private static String formatDouble(double v) {
        if (v == Math.floor(v)) return String.valueOf((int) v);
        return String.format("%.4f", v);
    }

    private static AssessmentType mapAssessmentType(String raw, EvidenceBundle evidence) {
        if (raw == null) return AssessmentType.INCONCLUSIVE;
        return switch (raw.toUpperCase().replace(' ', '_').replace('-', '_')) {
            case "HIGH_RISK"   -> evidence.getClusterSize() > 2
                    ? AssessmentType.POTENTIAL_COORDINATED_REFUND_ABUSE
                    : AssessmentType.POTENTIAL_ACCOUNT_FARMING;
            case "MEDIUM_RISK" -> AssessmentType.INCONCLUSIVE;
            case "LOW_RISK"    -> AssessmentType.NORMAL_BEHAVIOR;
            case "INCONCLUSIVE" -> AssessmentType.INCONCLUSIVE;
            default -> {
                try { yield AssessmentType.valueOf(raw.toUpperCase()); }
                catch (Exception ex) { yield AssessmentType.INCONCLUSIVE; }
            }
        };
    }
}
