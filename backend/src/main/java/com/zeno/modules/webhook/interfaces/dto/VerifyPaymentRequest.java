package com.zeno.modules.webhook.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for POST /api/v1/payments/razorpay/verify
 *
 * All three fields are returned by the Razorpay checkout modal's
 * onSuccess callback. The backend verifies the signature before
 * treating the payment as successful.
 */
public record VerifyPaymentRequest(
        @NotBlank(message = "razorpayOrderId is required")
        String razorpayOrderId,

        @NotBlank(message = "razorpayPaymentId is required")
        String razorpayPaymentId,

        @NotBlank(message = "razorpaySignature is required")
        String razorpaySignature
) {}
