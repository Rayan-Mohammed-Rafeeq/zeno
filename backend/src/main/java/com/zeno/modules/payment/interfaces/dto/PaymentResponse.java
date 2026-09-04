package com.zeno.modules.payment.interfaces.dto;

import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentMethod;
import com.zeno.modules.payment.domain.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentResponse(
        UUID id,
        UUID merchantId,
        UUID customerId,
        String externalPaymentId,
        BigDecimal amount,
        String currency,
        Instant timestamp,
        PaymentStatus status,
        PaymentMethod paymentMethod,
        String deviceId,
        String ipAddress,
        String addressFingerprint,
        Instant createdAt
) {
    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(
                p.getId(), p.getMerchantId(), p.getCustomerId(),
                p.getExternalPaymentId(), p.getAmount(), p.getCurrency(),
                p.getTimestamp(), p.getStatus(), p.getPaymentMethod(),
                p.getDeviceId(), p.getIpAddress(), p.getAddressFingerprint(),
                p.getCreatedAt());
    }
}
