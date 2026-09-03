package com.niro.modules.risk.application.detector;

import com.niro.modules.risk.domain.SignalType;

import java.util.Optional;

/**
 * Extension point for risk signal detection.
 * Each implementation is responsible for exactly one signal type.
 * Detectors are deterministic and stateless — they do not call LLMs.
 */
public interface RiskSignalDetector {
    SignalType type();
    Optional<RiskSignal> detect(RiskContext context);
}
