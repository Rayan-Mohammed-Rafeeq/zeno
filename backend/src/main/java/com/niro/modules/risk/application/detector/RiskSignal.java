package com.niro.modules.risk.application.detector;

import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.Builder;
import lombok.Getter;

/**
 * A single detected risk signal. Immutable value object produced by a detector.
 */
@Getter
@Builder
public class RiskSignal {
    private final SignalType signalType;
    private final double observedValue;
    private final double baselineValue;
    private final int scoreContribution;
    private final RiskLevel severity;
    private final String explanation;
}
