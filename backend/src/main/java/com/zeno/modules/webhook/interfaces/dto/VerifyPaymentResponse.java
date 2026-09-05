package com.zeno.modules.webhook.interfaces.dto;

/**
 * Response for POST /api/v1/payments/razorpay/verify
 *
 * verified=true means the HMAC-SHA256 signature matched.
 * The frontend should only treat the payment as complete when verified=true.
 */
public record VerifyPaymentResponse(
        boolean verified,
        String  message,
        /** The Razorpay payment ID, returned for convenience on success. */
        String  paymentId
) {
    public static VerifyPaymentResponse success(String paymentId) {
        return new VerifyPaymentResponse(true, "Payment verified successfully.", paymentId);
    }

    public static VerifyPaymentResponse failure(String reason) {
        return new VerifyPaymentResponse(false, reason, null);
    }
}
