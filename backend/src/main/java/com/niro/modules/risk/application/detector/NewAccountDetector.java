package com.niro.modules.risk.application.detector;

import com.niro.config.NiroProperties;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Flags new accounts (< 30 days old) as a low-weight contributing signal.
 * New accounts alone are not suspicious but amplify other signals.
 */
@Component
@RequiredArgsConstructor
public class NewAccountDetector implements RiskSignalDetector {

    private static final int NEW_ACCOUNT_DAYS = 30;

    private final NiroProperties properties;

    @Override
    public SignalType type() {
        return SignalType.NEW_ACCOUNT;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        Integer ageDays = ctx.getCustomer().getAccountAgeDays();
        if (ageDays == null || ageDays >= NEW_ACCOUNT_DAYS) return Optional.empty();

        int score = properties.getRisk().getThresholds().getNewAccountScore();

        String explanation = String.format(
                "Account is %d day(s) old — new accounts have limited transaction history for baseline comparison",
                ageDays);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.NEW_ACCOUNT)
                .observedValue((double) ageDays)
                .baselineValue((double) NEW_ACCOUNT_DAYS)
                .scoreContribution(score)
                .severity(RiskLevel.LOW)
                .explanation(explanation)
                .build());
    }
}
