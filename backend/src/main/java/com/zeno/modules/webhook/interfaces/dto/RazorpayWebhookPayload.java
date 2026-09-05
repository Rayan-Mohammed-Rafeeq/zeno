package com.zeno.modules.webhook.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Minimal deserialization of a Razorpay webhook payload.
 *
 * Razorpay sends a JSON body with this top-level shape:
 * {
 *   "entity": "event",
 *   "account_id": "acc_xxx",
 *   "event": "payment.captured",
 *   "contains": ["payment"],
 *   "payload": {
 *     "payment": { "entity": { ...payment fields... } }
 *     "refund":  { "entity": { ...refund fields...  } }   // for refund events
 *   },
 *   "created_at": 1234567890
 * }
 *
 * We only deserialize fields we actually use. Unknown fields are ignored
 * so future Razorpay schema changes don't break ingestion.
 *
 * ALL events from Test Mode are labeled source=RAZORPAY_TEST.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RazorpayWebhookPayload(

        @JsonProperty("entity")      String entity,
        @JsonProperty("account_id")  String accountId,
        @JsonProperty("event")       String event,
        @JsonProperty("payload")     PayloadWrapper payload,
        @JsonProperty("created_at")  Long createdAt

) {
    // ── Supported event types ─────────────────────────────────────────────
    public static final String EVENT_PAYMENT_CAPTURED   = "payment.captured";
    public static final String EVENT_PAYMENT_FAILED     = "payment.failed";
    public static final String EVENT_REFUND_CREATED     = "refund.created";
    public static final String EVENT_REFUND_PROCESSED   = "refund.processed";
    public static final String EVENT_REFUND_FAILED      = "refund.failed";

    // ── Razorpay payment method values ────────────────────────────────────
    public static final String METHOD_CARD       = "card";
    public static final String METHOD_UPI        = "upi";
    public static final String METHOD_NETBANKING = "netbanking";
    public static final String METHOD_WALLET     = "wallet";

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PayloadWrapper(
            @JsonProperty("payment") EntityWrapper<PaymentEntity> payment,
            @JsonProperty("refund")  EntityWrapper<RefundEntity>  refund
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EntityWrapper<T>(
            @JsonProperty("entity") T entity
    ) {}

    // ─────────────────────────────────────────────────────────────────────
    // Payment entity from Razorpay
    // ─────────────────────────────────────────────────────────────────────
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PaymentEntity(
            @JsonProperty("id")              String  id,              // pay_xxx
            @JsonProperty("entity")          String  entity,
            @JsonProperty("amount")          Long    amount,          // in smallest currency unit (paise)
            @JsonProperty("currency")        String  currency,        // "INR"
            @JsonProperty("status")          String  status,          // "captured" | "failed"
            @JsonProperty("method")          String  method,          // "card" | "upi" | "netbanking" | "wallet"
            @JsonProperty("order_id")        String  orderId,
            @JsonProperty("description")     String  description,
            @JsonProperty("email")           String  email,
            @JsonProperty("contact")         String  contact,
            @JsonProperty("customer_id")     String  customerId,      // cust_xxx (optional in Razorpay)
            @JsonProperty("card_id")         String  cardId,
            @JsonProperty("vpa")             String  vpa,             // UPI VPA
            @JsonProperty("bank")            String  bank,
            @JsonProperty("wallet")          String  wallet,
            @JsonProperty("error_code")      String  errorCode,
            @JsonProperty("error_description") String errorDescription,
            @JsonProperty("acquirer_data")   Map<String, Object> acquirerData,
            @JsonProperty("notes")           Map<String, Object> notes,
            @JsonProperty("created_at")      Long    createdAt,
            @JsonProperty("captured")        Boolean captured,
            @JsonProperty("international")   Boolean international,
            @JsonProperty("fee")             Long    fee,
            @JsonProperty("tax")             Long    tax
    ) {
        /**
         * Derive a stable external customer ID for upsert.
         * Priority: Razorpay customer_id → email → contact → payment_id (last resort).
         * We never invent a customer ID — we use only what Razorpay provides.
         */
        public String resolvedCustomerKey() {
            if (customerId != null && !customerId.isBlank()) return customerId;
            if (email      != null && !email.isBlank())      return "email:" + email.toLowerCase().trim();
            if (contact    != null && !contact.isBlank())    return "phone:" + contact.trim();
            return "anon:" + id; // payment-scoped anonymous customer
        }

        /** Amount in major currency units (e.g. INR, not paise). */
        public java.math.BigDecimal amountInMajorUnit() {
            if (amount == null) return java.math.BigDecimal.ZERO;
            return java.math.BigDecimal.valueOf(amount)
                    .divide(java.math.BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Refund entity from Razorpay
    // ─────────────────────────────────────────────────────────────────────
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RefundEntity(
            @JsonProperty("id")           String id,          // rfnd_xxx
            @JsonProperty("entity")       String entity,
            @JsonProperty("payment_id")   String paymentId,   // pay_xxx — links to payment
            @JsonProperty("amount")       Long   amount,       // in paise
            @JsonProperty("currency")     String currency,
            @JsonProperty("notes")        Map<String, Object> notes,
            @JsonProperty("status")       String status,       // "processed" | "failed" | "pending"
            @JsonProperty("speed_processed") String speedProcessed,
            @JsonProperty("acquirer_data")   Map<String, Object> acquirerData,
            @JsonProperty("created_at")   Long   createdAt
    ) {
        public java.math.BigDecimal amountInMajorUnit() {
            if (amount == null) return java.math.BigDecimal.ZERO;
            return java.math.BigDecimal.valueOf(amount)
                    .divide(java.math.BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }
    }

    // ── Convenience accessors ─────────────────────────────────────────────

    public PaymentEntity paymentEntity() {
        return payload != null && payload.payment() != null
                ? payload.payment().entity()
                : null;
    }

    public RefundEntity refundEntity() {
        return payload != null && payload.refund() != null
                ? payload.refund().entity()
                : null;
    }

    public boolean isPaymentEvent() {
        return event != null && event.startsWith("payment.");
    }

    public boolean isRefundEvent() {
        return event != null && event.startsWith("refund.");
    }
}
