package com.niro.modules.risk.application.detector;

import com.niro.config.NiroProperties;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Detects abnormal transaction velocity — many payments in a short window.
 * Uses a 24-hour sliding window.
 */
@Component
@RequiredArgsConstructor
public class VelocityDetector implements RiskSignalDetector {

    private static final int HIGH_VELOCITY_THRESHOLD   = 10;
    private static final int MEDIUM_VELOCITY_THRESHOLD = 5;
    private static final Duration WINDOW = Duration.ofHours(24);

    private final NiroProperties properties;

    @Override
    public SignalType type() {
        return SignalType.TRANSACTION_VELOCITY;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        List<Payment> payments = ctx.getCustomerPayments();
        if (payments.size() < MEDIUM_VELOCITY_THRESHOLD) return Optional.empty();

        Instant windowStart = Instant.now().minus(WINDOW);
        long countInWindow = payments.stream()
                .filter(p -> p.getTimestamp().isAfter(windowStart))
                .count();

        if (countInWindow < MEDIUM_VELOCITY_THRESHOLD) return Optional.empty();

        int score = properties.getRisk().getThresholds().getTransactionVelocityScore();
        RiskLevel severity = countInWindow >= HIGH_VELOCITY_THRESHOLD ? RiskLevel.HIGH : RiskLevel.MEDIUM;

        String explanation = String.format(
                "%d transactions observed in the past 24 hours (threshold: %d)",
                countInWindow, MEDIUM_VELOCITY_THRESHOLD);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.TRANSACTION_VELOCITY)
                .observedValue((double) countInWindow)
                .baselineValue((double) MEDIUM_VELOCITY_THRESHOLD)
                .scoreContribution(score)
                .severity(severity)
                .explanation(explanation)
                .build());
    }
}
