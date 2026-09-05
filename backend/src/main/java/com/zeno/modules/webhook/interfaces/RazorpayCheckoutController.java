package com.zeno.modules.webhook.interfaces;

import com.zeno.modules.webhook.application.RazorpayCheckoutService;
import com.zeno.modules.webhook.interfaces.dto.CreateOrderRequest;
import com.zeno.modules.webhook.interfaces.dto.CreateOrderResponse;
import com.zeno.modules.webhook.interfaces.dto.VerifyPaymentRequest;
import com.zeno.modules.webhook.interfaces.dto.VerifyPaymentResponse;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Razorpay Standard Checkout endpoints.
 *
 * POST /api/v1/payments/razorpay/order   — create a Razorpay order (requires JWT)
 * POST /api/v1/payments/razorpay/verify  — verify payment signature (requires JWT)
 *
 * These endpoints require JWT authentication — order creation is a privileged
 * operation. In a production scenario you would also associate the order with
 * the authenticated merchant/user.
 *
 * KEY_SECRET is never returned to the frontend.
 * Only the order_id, amount, and currency are returned from /order.
 */
@RestController
@RequestMapping("/api/v1/payments/razorpay")
@RequiredArgsConstructor
@Tag(name = "Razorpay Checkout", description = "Standard Checkout order creation and payment verification")
public class RazorpayCheckoutController {

    private final RazorpayCheckoutService checkoutService;

    /**
     * Create a Razorpay order.
     *
     * The frontend calls this first, receives the order_id, then opens
     * the Razorpay checkout modal with the order_id.
     *
     * Request:  { amount (paise, min 100), currency, receipt }
     * Response: { orderId, amount, currency, receipt, status }
     */
    @PostMapping("/order")
    @Operation(summary = "Create a Razorpay order",
               description = "Creates a server-side Razorpay order. " +
                             "Call this before opening the checkout modal. " +
                             "Returns order_id which the modal needs. " +
                             "Requires JWT authentication.")
    public ResponseEntity<ApiResponse<CreateOrderResponse>> createOrder(
            @Valid @RequestBody CreateOrderRequest request) {
        CreateOrderResponse response = checkoutService.createOrder(request);
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    /**
     * Verify a Razorpay payment signature.
     *
     * After the checkout modal succeeds, Razorpay sends three values to the
     * frontend. The frontend forwards them here. We verify the HMAC-SHA256
     * signature on the backend using the KEY_SECRET before marking the
     * payment as successful.
     *
     * Returns 200 + verified=true on success.
     * Returns 400 + verified=false on signature mismatch.
     * NEVER mark a payment successful without verifying here first.
     */
    @PostMapping("/verify")
    @Operation(summary = "Verify a Razorpay payment signature",
               description = "Verifies the HMAC-SHA256 signature returned by the checkout modal. " +
                             "Returns verified=true only when the signature matches. " +
                             "Do NOT treat a payment as successful until this returns verified=true.")
    public ResponseEntity<ApiResponse<VerifyPaymentResponse>> verifyPayment(
            @Valid @RequestBody VerifyPaymentRequest request) {
        VerifyPaymentResponse result = checkoutService.verifyPayment(request);
        if (result.verified()) {
            return ResponseEntity.ok(ApiResponse.of(result));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.of(result));
        }
    }
}
