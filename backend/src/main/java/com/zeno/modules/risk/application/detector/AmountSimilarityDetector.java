package com.zeno.modules.risk.application.detector;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.risk.domain.RiskLevel;
import com.zeno.modules.risk.domain.SignalType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Detects suspiciously similar transaction amounts across a customer's payments.
 * Coordinated abuse often uses very close amounts to stay under detection thresholds.
 */
@Component
@RequiredArgsConstructor
public class AmountSimilarityDetector implements RiskSignalDetector {

    private static final int MIN_PAYMENTS = 3;
    /** Max allowed standard deviation as % of mean to flag as suspicious */
    private static final double CV_THRESHOLD = 0.03; // 3% coefficient of variation

    private final ZenoProperties properties;

    @Override
    public SignalType type() {
        return SignalType.AMOUNT_SIMILARITY;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        List<Payment> payments = ctx.getCustomerPayments();
        if (payments.size() < MIN_PAYMENTS) return Optional.empty();

        double[] amounts = payments.stream()
                .map(Payment::getAmount)
                .mapToDouble(BigDecimal::doubleValue)
                .toArray();

        double mean = 0;
        for (double a : amounts) mean += a;
        mean /= amounts.length;

        if (mean < 1.0) return Optional.empty();

        double variance = 0;
        for (double a : amounts) variance += (a - mean) * (a - mean);
        double stdDev = Math.sqrt(variance / amounts.length);
        double cv = stdDev / mean;

        if (cv > CV_THRESHOLD) return Optional.empty();

        int score = properties.getRisk().getThresholds().getAmountSimilarityScore();

        String explanation = String.format(
                "%d payments with highly similar amounts (mean: %.2f, CV: %.2f%%) — consistent with structuring",
                payments.size(), mean, cv * 100);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.AMOUNT_SIMILARITY)
                .observedValue(cv)
                .baselineValue(CV_THRESHOLD)
                .scoreContribution(score)
                .severity(RiskLevel.MEDIUM)
                .explanation(explanation)
                .build());
    }
}
