package com.niro.modules.risk.application.detector;

import com.niro.config.NiroProperties;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Detects abnormal refund rates relative to the merchant baseline.
 * Triggers when the customer's refund rate is more than 2x the baseline
 * and exceeds an absolute threshold.
 */
@Component
@RequiredArgsConstructor
public class RefundRateDetector implements RiskSignalDetector {

    private static final double ABSOLUTE_THRESHOLD = 0.30;
    private static final double MULTIPLIER_THRESHOLD = 2.0;

    private final NiroProperties properties;

    @Override
    public SignalType type() {
        return SignalType.REFUND_RATE;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        int payments = ctx.getCustomerPayments().size();
        if (payments == 0) return Optional.empty();

        double refundRate = (double) ctx.getCustomerRefunds().size() / payments;
        double baseline   = Math.max(ctx.getMerchantBaselineRefundRate(), 0.01);

        boolean aboveAbsolute    = refundRate > ABSOLUTE_THRESHOLD;
        boolean aboveMultiplier  = refundRate > baseline * MULTIPLIER_THRESHOLD;

        if (!aboveAbsolute && !aboveMultiplier) return Optional.empty();

        int score = properties.getRisk().getThresholds().getRefundRateAnomalyScore();
        RiskLevel severity = refundRate > 0.70 ? RiskLevel.CRITICAL
                           : refundRate > 0.50 ? RiskLevel.HIGH
                           : RiskLevel.MEDIUM;

        String explanation = String.format(
                "Customer refund rate %.0f%% is %.1fx merchant baseline of %.0f%%",
                refundRate * 100, refundRate / baseline, baseline * 100);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.REFUND_RATE)
                .observedValue(refundRate)
                .baselineValue(baseline)
                .scoreContribution(score)
                .severity(severity)
                .explanation(explanation)
                .build());
    }
}
