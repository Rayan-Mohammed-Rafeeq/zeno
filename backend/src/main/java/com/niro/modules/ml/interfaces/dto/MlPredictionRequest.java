package com.niro.modules.ml.interfaces.dto;

import com.niro.modules.customer.domain.Customer;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.refund.domain.Refund;

import java.time.Instant;
import java.util.List;

/**
 * Payload sent from Spring Boot to the Python FastAPI ML service.
 *
 * Contains the transaction being scored plus historical customer context
 * computed from data strictly before the transaction timestamp
 * (temporal leakage prevention — enforced here, not in the Python service).
 */
public record MlPredictionRequest(
        TransactionPayload transaction,
        CustomerContextPayload customerContext
) {
    public record TransactionPayload(
            String transactionId,
            String merchantId,
            String customerId,
            Instant timestamp,
            double amount,
            String currency,
            String paymentMethod,
            String deviceId,
            String ipAddress,
            String billingCountry,
            String shippingCountry,
            String merchantCategory,
            String emailDomain
    ) {}

    public record CustomerContextPayload(
            Integer accountAgeDays,
            int historicalTransactionCount,
            double historicalTotalAmount,
            int historicalRefundCount,
            int historicalDeviceCount,
            int historicalIpCount,
            Double historicalFraudRate
    ) {}

    /**
     * Build a request from domain objects.
     * customerContext is computed from prior transactions only (strictly before payment.timestamp).
     */
    public static MlPredictionRequest from(
            Payment payment,
            Customer customer,
            List<Payment> priorPayments,
            List<Refund> priorRefunds
    ) {
        var tx = new TransactionPayload(
                payment.getExternalPaymentId(),
                payment.getMerchantId().toString(),
                payment.getCustomerId().toString(),
                payment.getTimestamp(),
                payment.getAmount() != null ? payment.getAmount().doubleValue() : 0.0,
                payment.getCurrency(),
                payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : "UNKNOWN",
                payment.getDeviceId(),
                payment.getIpAddress(),
                customer.getCountry(),
                null,   // shipping_country not available in current schema
                "UNKNOWN",
                null
        );

        // Historical aggregates from PRIOR transactions only
        double totalPrior = priorPayments.stream()
                .mapToDouble(p -> p.getAmount() != null ? p.getAmount().doubleValue() : 0.0)
                .sum();

        long distinctDevices = priorPayments.stream()
                .map(Payment::getDeviceId)
                .filter(d -> d != null && !d.isBlank())
                .distinct().count();

        long distinctIps = priorPayments.stream()
                .map(Payment::getIpAddress)
                .filter(ip -> ip != null && !ip.isBlank())
                .distinct().count();

        var ctx = new CustomerContextPayload(
                customer.getAccountAgeDays(),
                priorPayments.size(),
                totalPrior,
                priorRefunds.size(),
                (int) distinctDevices,
                (int) distinctIps,
                null   // historical fraud rate not available without labels
        );

        return new MlPredictionRequest(tx, ctx);
    }
}
