package com.zeno.modules.webhook.interfaces.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for POST /api/v1/payments/razorpay/order
 *
 * amount is in paise (smallest currency unit).
 * Minimum 100 paise (₹1). Razorpay rejects anything smaller.
 */
public record CreateOrderRequest(
        @NotNull(message = "amount is required")
        @Min(value = 100, message = "amount must be at least 100 paise (₹1)")
        Long amount,

        @NotBlank(message = "currency is required")
        String currency,

        /** Optional human-readable receipt identifier for your records. */
        String receipt,

        /** Optional description shown in Razorpay dashboard. */
        String description
) {
    public CreateOrderRequest {
        if (currency == null || currency.isBlank()) currency = "INR";
        if (receipt  == null || receipt.isBlank())  receipt  = "rcpt_" + System.currentTimeMillis();
    }
}
