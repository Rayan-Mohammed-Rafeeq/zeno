package com.niro.modules.risk.interfaces.dto;

import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.RiskSignalEntity;
import com.niro.modules.risk.domain.SignalType;

public record RiskSignalResponse(
        SignalType signalType,
        double observedValue,
        double baselineValue,
        int scoreContribution,
        RiskLevel severity,
        String explanation
) {
    public static RiskSignalResponse from(RiskSignalEntity e) {
        return new RiskSignalResponse(
                e.getSignalType(), e.getObservedValue(), e.getBaselineValue(),
                e.getScoreContribution(), e.getSeverity(), e.getExplanation());
    }
}
