package com.niro.modules.risk.application.detector;

import com.niro.config.NiroProperties;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Detects when this customer's IP addresses are shared by multiple other customers.
 */
@Component
@RequiredArgsConstructor
public class SharedIpDetector implements RiskSignalDetector {

    private static final int SHARED_CUSTOMER_THRESHOLD = 3;

    private final NiroProperties properties;

    @Override
    public SignalType type() {
        return SignalType.IP_REUSE;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        if (ctx.getSharedIpPayments().isEmpty()) return Optional.empty();

        Set<String> myIps = ctx.getCustomerPayments().stream()
                .map(Payment::getIpAddress)
                .filter(ip -> ip != null && !ip.isBlank())
                .collect(Collectors.toSet());

        if (myIps.isEmpty()) return Optional.empty();

        long otherCustomers = ctx.getSharedIpPayments().stream()
                .filter(p -> !p.getCustomerId().equals(ctx.getCustomer().getId()))
                .filter(p -> myIps.contains(p.getIpAddress()))
                .map(Payment::getCustomerId)
                .distinct()
                .count();

        if (otherCustomers < SHARED_CUSTOMER_THRESHOLD) return Optional.empty();

        int score = properties.getRisk().getThresholds().getSharedIpScore();
        RiskLevel severity = otherCustomers >= 8 ? RiskLevel.HIGH : RiskLevel.MEDIUM;

        String explanation = String.format(
                "IP address shared with %d other customer(s) — may indicate shared infrastructure or proxying",
                otherCustomers);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.IP_REUSE)
                .observedValue((double) otherCustomers)
                .baselineValue(1.0)
                .scoreContribution(score)
                .severity(severity)
                .explanation(explanation)
                .build());
    }
}
