package com.zeno.modules.webhook.interfaces.dto;

/**
 * Response for POST /api/v1/payments/razorpay/order
 *
 * Contains exactly what the frontend needs to open the Razorpay checkout modal.
 * The KEY_SECRET is NOT included — it never leaves the backend.
 */
public record CreateOrderResponse(
        String orderId,
        Long   amount,
        String currency,
        String receipt,
        /** Razorpay order status — typically "created" */
        String status
) {}
