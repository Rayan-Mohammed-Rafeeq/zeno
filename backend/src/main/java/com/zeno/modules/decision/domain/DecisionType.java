package com.zeno.modules.decision.domain;

/**
 * All decision types are purely defensive recommendations.
 * HOLD is a recommendation/status only — no real payment blocking is implemented.
 * No offensive or irreversible actions are defined here.
 */
public enum DecisionType {
    ALLOW,
    MONITOR,
    MANUAL_REVIEW,
    HOLD,
    ESCALATE
}
