package com.zeno.modules.customer.interfaces.dto;

import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.risk.domain.RiskLevel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

/**
 * Enriched customer summary for the customer list view.
 *
 * Aggregates data from payments, refunds, and risk assessments so the
 * frontend can display the full table without additional requests.
 *
 * Field mapping to the frontend Customer type:
 *   id              → Customer.id
 *   customerId      → Customer.externalCustomerId
 *   name            → derived from externalCustomerId (synthetic data has no real names)
 *   transactionCount→ COUNT(payments)
 *   totalAmount     → SUM(payment.amount)
 *   refundCount     → COUNT(refunds)
 *   refundRate      → refundCount / transactionCount * 100 (0 when no transactions)
 *   deviceCount     → COUNT(DISTINCT payment.deviceId)
 *   ipCount         → COUNT(DISTINCT payment.ipAddress)
 *   riskScore       → latest RiskAssessment.riskScore  (null when no assessment yet)
 *   riskLevel       → latest RiskAssessment.riskLevel  (null when no assessment yet)
 *   status          → Customer.status
 *   firstSeen       → Customer.createdAt
 *   lastActivity    → MAX(payment.timestamp)           (null when no payments yet)
 *   createdAt       → Customer.createdAt
 */
public record CustomerSummaryResponse(
        UUID    id,
        String  customerId,
        String  name,
        long    transactionCount,
        BigDecimal totalAmount,
        long    refundCount,
        double  refundRate,
        long    deviceCount,
        long    ipCount,
        Integer riskScore,
        String  riskLevel,
        CustomerStatus status,
        Instant firstSeen,
        Instant lastActivity,
        Instant createdAt
) {

    /**
     * Build a summary from a customer + pre-aggregated maps.
     * All aggregate values default to zero/null when the customer has no data yet
     * (e.g. fresh import, no payments run yet).
     */
    public static CustomerSummaryResponse from(
            Customer customer,
            long     txnCount,
            BigDecimal totalAmt,
            Instant  lastPayment,
            long     devCount,
            long     ipCount,
            long     refCount,
            Integer  riskScore,
            RiskLevel riskLevel
    ) {
        double rate = txnCount > 0
                ? BigDecimal.valueOf(refCount * 100.0 / txnCount)
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue()
                : 0.0;

        return new CustomerSummaryResponse(
                customer.getId(),
                customer.getExternalCustomerId(),
                deriveName(customer.getExternalCustomerId()),
                txnCount,
                totalAmt != null ? totalAmt : BigDecimal.ZERO,
                refCount,
                rate,
                devCount,
                ipCount,
                riskScore,
                riskLevel != null ? riskLevel.name() : null,
                customer.getStatus(),
                customer.getCreatedAt(),
                lastPayment,
                customer.getCreatedAt()
        );
    }

    /**
     * Derives a display name from the external customer ID.
     * Synthetic customers use IDs like "EXT-098D6A1463".
     * Strip known prefixes and return the identifier in a readable form.
     */
    private static String deriveName(String externalCustomerId) {
        if (externalCustomerId == null || externalCustomerId.isBlank()) {
            return "Unknown";
        }
        // Strip common synthetic prefixes (EXT-, CUST-, etc.)
        String stripped = externalCustomerId.replaceFirst("(?i)^(EXT|CUST|USR|USER|CID)[_\\-]", "");
        // If still looks like a long hex string, abbreviate it
        if (stripped.matches("[0-9A-Fa-f]{8,}")) {
            stripped = stripped.substring(0, 8).toUpperCase();
        }
        return stripped.toUpperCase();
    }
}
