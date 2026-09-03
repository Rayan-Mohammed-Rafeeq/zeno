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
 * Detects when the customer's device fingerprints are shared by multiple other customers.
 * A shared device is a strong signal of coordinated abuse.
 */
@Component
@RequiredArgsConstructor
public class SharedDeviceDetector implements RiskSignalDetector {

    private static final int SHARED_CUSTOMER_THRESHOLD = 2;

    private final NiroProperties properties;

    @Override
    public SignalType type() {
        return SignalType.DEVICE_REUSE;
    }

    @Override
    public Optional<RiskSignal> detect(RiskContext ctx) {
        if (ctx.getSharedDevicePayments().isEmpty()) return Optional.empty();

        // Count distinct *other* customers on the same device(s)
        Set<String> myDevices = ctx.getCustomerPayments().stream()
                .map(Payment::getDeviceId)
                .filter(d -> d != null && !d.isBlank())
                .collect(Collectors.toSet());

        if (myDevices.isEmpty()) return Optional.empty();

        long otherCustomers = ctx.getSharedDevicePayments().stream()
                .filter(p -> !p.getCustomerId().equals(ctx.getCustomer().getId()))
                .filter(p -> myDevices.contains(p.getDeviceId()))
                .map(Payment::getCustomerId)
                .distinct()
                .count();

        if (otherCustomers < SHARED_CUSTOMER_THRESHOLD) return Optional.empty();

        int score = properties.getRisk().getThresholds().getSharedDeviceScore();
        RiskLevel severity = otherCustomers >= 5 ? RiskLevel.CRITICAL
                           : otherCustomers >= 3 ? RiskLevel.HIGH
                           : RiskLevel.MEDIUM;

        String explanation = String.format(
                "Device fingerprint shared with %d other customer(s), indicating potential coordinated activity",
                otherCustomers);

        return Optional.of(RiskSignal.builder()
                .signalType(SignalType.DEVICE_REUSE)
                .observedValue((double) otherCustomers)
                .baselineValue(1.0)
                .scoreContribution(score)
                .severity(severity)
                .explanation(explanation)
                .build());
    }
}
