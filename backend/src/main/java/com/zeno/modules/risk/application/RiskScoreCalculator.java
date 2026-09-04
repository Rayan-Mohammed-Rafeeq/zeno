package com.zeno.modules.risk.application;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.risk.application.detector.RiskSignal;
import com.zeno.modules.risk.domain.RiskLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Aggregates individual signal contributions into a final risk score and level.
 * Thresholds are configurable via application properties — not hard-coded.
 *
 * Score is capped at 100. Thresholds (configurable, prototype defaults):
 *   MEDIUM:   >= 40
 *   HIGH:     >= 70
 *   CRITICAL: >= 90
 */
@Component
@RequiredArgsConstructor
public class RiskScoreCalculator {

    private final ZenoProperties properties;

    public int calculateScore(List<RiskSignal> signals) {
        int raw = signals.stream()
                .mapToInt(RiskSignal::getScoreContribution)
                .sum();
        return Math.min(raw, 100);
    }

    public RiskLevel calculateLevel(int score) {
        ZenoProperties.Risk.Thresholds t = properties.getRisk().getThresholds();
        if (score >= t.getCriticalRiskThreshold()) return RiskLevel.CRITICAL;
        if (score >= t.getHighRiskThreshold())     return RiskLevel.HIGH;
        if (score >= t.getMediumRiskThreshold())   return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }
}
