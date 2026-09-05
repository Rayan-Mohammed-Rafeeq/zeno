package com.zeno.modules.payment.interfaces.dto;

import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentMethod;
import com.zeno.modules.payment.domain.PaymentStatus;
import com.zeno.modules.refund.domain.Refund;
import com.zeno.modules.risk.domain.RiskAssessment;
import com.zeno.modules.risk.domain.RiskLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Enriched transaction summary for the Transactions list and detail views.
 *
 * Aggregates data from payments, risk assessments, refunds, and customers so
 * the frontend can populate every column without additional requests.
 *
 * Frontend Transaction type field mapping:
 *   id              → Payment.id
 *   transactionId   → Payment.externalPaymentId (falls back to id string)
 *   customerId      → Payment.customerId
 *   customerName    → Customer.externalCustomerId (title-cased, same derivation as CustomerSummaryResponse)
 *   amount          → Payment.amount
 *   currency        → Payment.currency
 *   status          → Payment.status
 *   paymentMethod   → Payment.paymentMethod
 *   deviceId        → Payment.deviceId
 *   ipAddress       → Payment.ipAddress
 *   isRefunded      → refund != null
 *   refundAmount    → Refund.amount
 *   refundDate      → Refund.completedAt (or requestedAt)
 *   riskScore       → RiskAssessment.riskScore   (null when no assessment yet)
 *   riskLevel       → RiskAssessment.riskLevel   (null when no assessment yet)
 *   signalCount     → count of RiskSignals for this customer's latest assessment
 *   timestamp       → Payment.timestamp
 *   createdAt       → Payment.createdAt
 */
public record TransactionSummaryResponse(
        UUID        id,
        String      transactionId,
        UUID        customerId,
        String      customerName,
        BigDecimal  amount,
        String      currency,
        PaymentStatus status,
        PaymentMethod paymentMethod,
        String      deviceId,
        String      ipAddress,
        boolean     isRefunded,
        BigDecimal  refundAmount,
        Instant     refundDate,
        Integer     riskScore,
        String      riskLevel,
        int         signalCount,
        Instant     timestamp,
        Instant     createdAt
) {

    /**
     * Build a transaction summary from a payment + optional enrichment data.
     *
     * @param payment       the payment entity
     * @param customerName  display name derived from externalCustomerId (may be null → falls back)
     * @param refund        matched refund for this payment (null if not refunded)
     * @param assessment    latest risk assessment for the customer (null if none)
     * @param sigCount      number of risk signals for the customer's assessment
     */
    public static TransactionSummaryResponse from(
            Payment     payment,
            String      customerName,
            Refund      refund,
            RiskAssessment assessment,
            int         sigCount
    ) {
        String txnId = (payment.getExternalPaymentId() != null && !payment.getExternalPaymentId().isBlank())
                ? payment.getExternalPaymentId()
                : payment.getId().toString();

        return new TransactionSummaryResponse(
                payment.getId(),
                txnId,
                payment.getCustomerId(),
                customerName != null ? customerName : "Customer " + payment.getCustomerId().toString().substring(0, 8),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getStatus(),
                payment.getPaymentMethod(),
                payment.getDeviceId(),
                payment.getIpAddress(),
                refund != null,
                refund != null ? refund.getAmount() : null,
                refund != null ? (refund.getCompletedAt() != null ? refund.getCompletedAt() : refund.getRequestedAt()) : null,
                assessment != null ? assessment.getRiskScore() : null,
                assessment != null ? assessment.getRiskLevel().name() : null,
                sigCount,
                payment.getTimestamp(),
                payment.getCreatedAt()
        );
    }
}
