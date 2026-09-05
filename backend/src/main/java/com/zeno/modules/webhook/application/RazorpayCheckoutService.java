package com.zeno.modules.webhook.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.webhook.interfaces.dto.CreateOrderRequest;
import com.zeno.modules.webhook.interfaces.dto.CreateOrderResponse;
import com.zeno.modules.webhook.interfaces.dto.VerifyPaymentRequest;
import com.zeno.modules.webhook.interfaces.dto.VerifyPaymentResponse;
import com.zeno.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

/**
 * Razorpay Standard Checkout service.
 *
 * Handles two operations:
 *  1. createOrder  — calls POST https://api.razorpay.com/v1/orders (Basic Auth)
 *  2. verifyPayment — verifies HMAC-SHA256 signature (no external call needed)
 *
 * KEY_SECRET is used exclusively in this class and is never logged or returned
 * to the caller (controller returns only what it needs to the frontend).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RazorpayCheckoutService {

    private static final String RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

    private final ZenoProperties properties;
    private final ObjectMapper   objectMapper;

    // ─────────────────────────────────────────────────────────────────────
    // Create Order
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Create a Razorpay order.
     *
     * Calls POST https://api.razorpay.com/v1/orders using HTTP Basic Auth
     * (keyId:keySecret). The order ID is returned to the frontend for use
     * in the checkout modal.
     *
     * @throws ExternalServiceException if Razorpay returns a non-2xx response
     * @throws IllegalStateException    if credentials are not configured
     */
    public CreateOrderResponse createOrder(CreateOrderRequest request) {
        validateCredentials();

        Map<String, Object> body = Map.of(
                "amount",   request.amount(),
                "currency", request.currency(),
                "receipt",  request.receipt()
        );

        try {
            RestClient client = buildClient();
            String responseBody = client.post()
                    .uri(RAZORPAY_ORDERS_URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode node = objectMapper.readTree(responseBody);

            String orderId  = node.get("id").asText();
            long   amount   = node.get("amount").asLong();
            String currency = node.get("currency").asText();
            String receipt  = node.path("receipt").asText(request.receipt());
            String status   = node.path("status").asText("created");

            log.info("Razorpay order created: {} amount={} {}", orderId, amount, currency);
            return new CreateOrderResponse(orderId, amount, currency, receipt, status);

        } catch (RestClientResponseException ex) {
            String detail = ex.getResponseBodyAsString();
            log.error("Razorpay order creation failed: HTTP {} — {}", ex.getStatusCode(), detail);
            throw new ExternalServiceException("Razorpay",
                    "Order creation failed: " + ex.getStatusCode());
        } catch (ExternalServiceException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Unexpected error creating Razorpay order: {}", ex.getMessage(), ex);
            throw new ExternalServiceException("Razorpay", "Unexpected error: " + ex.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Verify Payment Signature
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Verify the HMAC-SHA256 payment signature returned by Razorpay checkout.
     *
     * Algorithm (per Razorpay docs):
     *   payload  = orderId + "|" + paymentId
     *   expected = HMAC-SHA256(payload, KEY_SECRET)
     *   verified = constant_time_equals(expected, razorpaySignature)
     *
     * Returns failure (not exception) on mismatch so the controller
     * can return 400 without leaking timing information.
     */
    public VerifyPaymentResponse verifyPayment(VerifyPaymentRequest request) {
        if (request.razorpayOrderId()  == null || request.razorpayOrderId().isBlank()  ||
            request.razorpayPaymentId() == null || request.razorpayPaymentId().isBlank() ||
            request.razorpaySignature() == null || request.razorpaySignature().isBlank()) {
            return VerifyPaymentResponse.failure("Missing required fields.");
        }

        try {
            validateCredentials();

            String payload = request.razorpayOrderId() + "|" + request.razorpayPaymentId();
            String secret  = properties.getRazorpay().getKeySecret();

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed    = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computed);

            // Constant-time comparison — prevents timing attacks
            boolean match = MessageDigest.isEqual(
                    computedHex.getBytes(StandardCharsets.UTF_8),
                    request.razorpaySignature().getBytes(StandardCharsets.UTF_8));

            if (match) {
                log.info("Payment verified: orderId={} paymentId={}",
                        request.razorpayOrderId(), request.razorpayPaymentId());
                return VerifyPaymentResponse.success(request.razorpayPaymentId());
            } else {
                log.warn("Payment signature mismatch for orderId={}", request.razorpayOrderId());
                return VerifyPaymentResponse.failure("Signature verification failed.");
            }

        } catch (IllegalStateException ex) {
            log.error("Razorpay credentials not configured for verification");
            return VerifyPaymentResponse.failure("Payment gateway not configured.");
        } catch (Exception ex) {
            log.error("Error verifying payment signature: {}", ex.getMessage(), ex);
            return VerifyPaymentResponse.failure("Verification error: " + ex.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private RestClient buildClient() {
        String keyId     = properties.getRazorpay().getKeyId();
        String keySecret = properties.getRazorpay().getKeySecret();
        // HTTP Basic Auth: Base64(keyId:keySecret)
        String credentials = Base64.getEncoder()
                .encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));
        return RestClient.builder()
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .defaultHeader(HttpHeaders.CONTENT_TYPE,  MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT,         MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private void validateCredentials() {
        String keyId     = properties.getRazorpay().getKeyId();
        String keySecret = properties.getRazorpay().getKeySecret();
        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            throw new IllegalStateException(
                    "Razorpay credentials not configured. " +
                    "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env");
        }
    }
}
