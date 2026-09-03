package com.niro.modules.decision.application;

import com.niro.modules.decision.domain.DecisionType;
import com.niro.modules.risk.domain.RiskLevel;
import org.springframework.stereotype.Component;

/**
 * Deterministic, bounded decision policy.
 *
 * Maps risk level → defensive recommendation.
 * All recommendations are advisory — no real payment blocking occurs.
 *
 * Default policy (configurable for overrides):
 *   LOW      → ALLOW
 *   MEDIUM   → MONITOR
 *   HIGH     → MANUAL_REVIEW
 *   CRITICAL → ESCALATE
 *
 * Note: HOLD is available as a recommendation but is never applied automatically.
 */
@Component
public class DecisionPolicy {

    public DecisionType recommend(RiskLevel riskLevel) {
        return switch (riskLevel) {
            case LOW      -> DecisionType.ALLOW;
            case MEDIUM   -> DecisionType.MONITOR;
            case HIGH     -> DecisionType.MANUAL_REVIEW;
            case CRITICAL -> DecisionType.ESCALATE;
        };
    }

    public String rationale(RiskLevel riskLevel, DecisionType decision) {
        return switch (decision) {
            case ALLOW         -> "Risk level " + riskLevel + " is within acceptable bounds. No action required.";
            case MONITOR       -> "Elevated risk level " + riskLevel + ". Monitoring recommended without blocking.";
            case MANUAL_REVIEW -> "Risk level " + riskLevel + " warrants analyst review before proceeding.";
            case HOLD          -> "Risk level " + riskLevel + " — advisory hold recommended pending investigation.";
            case ESCALATE      -> "Critical risk level detected. Immediate escalation to senior analyst required.";
        };
    }
}
