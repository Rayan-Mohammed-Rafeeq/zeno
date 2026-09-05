package com.zeno.modules.webhook.interfaces.dto;

import com.zeno.modules.webhook.domain.WebhookEvent;
import com.zeno.modules.webhook.domain.WebhookStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Response DTO for a webhook event — used by the live monitoring UI.
 *
 * The UI must display source=RAZORPAY_TEST prominently.
 * Risk scores shown here are from the same XGBoost+rules pipeline
 * as the synthetic demo; they are NOT Razorpay production metrics.
 */
public record WebhookEventResponse(
        UUID       id,
        UUID       merchantId,
        String     razorpayEventId,
        String     eventType,
        WebhookStatus status,
        UUID       paymentId,
        UUID       refundId,
        Integer    riskScore,
        String     riskLevel,
        String     errorMessage,
        String     source,
        Instant    createdAt
) {
    public static WebhookEventResponse from(WebhookEvent e) {
        return new WebhookEventResponse(
                e.getId(), e.getMerchantId(),
                e.getRazorpayEventId(), e.getEventType(),
                e.getStatus(),
                e.getPaymentId(), e.getRefundId(),
                e.getRiskScore(), e.getRiskLevel(),
                e.getErrorMessage(),
                e.getSource(),
                e.getCreatedAt()
        );
    }
}
