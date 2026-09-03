package com.niro.modules.refund.interfaces.dto;

import com.niro.modules.refund.domain.Refund;
import com.niro.modules.refund.domain.RefundReason;
import com.niro.modules.refund.domain.RefundStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RefundResponse(
        UUID id,
        UUID merchantId,
        UUID paymentId,
        UUID customerId,
        BigDecimal amount,
        RefundReason reason,
        RefundStatus status,
        Instant requestedAt,
        Instant completedAt,
        Instant createdAt
) {
    public static RefundResponse from(Refund r) {
        return new RefundResponse(
                r.getId(), r.getMerchantId(), r.getPaymentId(), r.getCustomerId(),
                r.getAmount(), r.getReason(), r.getStatus(),
                r.getRequestedAt(), r.getCompletedAt(), r.getCreatedAt());
    }
}
