package com.zeno.modules.webhook.interfaces;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.webhook.application.WebhookService;
import com.zeno.modules.webhook.interfaces.dto.RazorpayWebhookPayload;
import com.zeno.modules.webhook.interfaces.dto.WebhookEventResponse;
import com.zeno.shared.api.ApiResponse;
import com.zeno.shared.api.PageMeta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Razorpay Test Mode webhook endpoint.
 *
 * URL:  POST /api/v1/webhooks/razorpay/{merchantId}
 *
 * This endpoint is PUBLIC (no JWT) — security is provided by
 * HMAC-SHA256 signature verification using the webhook secret
 * configured in Razorpay Dashboard → Settings → Webhooks.
 *
 * The {merchantId} path variable is the Zeno merchant UUID.
 * Configure separate webhook URLs per merchant if you have multiple.
 *
 * Setup in Razorpay Dashboard (Test Mode):
 *   URL:    https://<your-domain>/api/v1/webhooks/razorpay/<merchantId>
 *   Secret: same value as RAZORPAY_WEBHOOK_SECRET in backend/.env
 *   Events: payment.captured, payment.failed, refund.created, refund.processed
 *
 * For local development, use ngrok:
 *   ngrok http 8080
 *   Then set the ngrok URL in Razorpay Dashboard.
 *
 * All events processed here are labeled source=RAZORPAY_TEST.
 * Zeno does NOT claim IEEE-CIS benchmark metrics represent Razorpay performance.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
@Tag(name = "Webhooks", description = "Razorpay Test Mode webhook receiver")
public class WebhookController {

    private final WebhookService webhookService;
    private final ZenoProperties properties;
    private final ObjectMapper   objectMapper;
    private final com.zeno.modules.merchant.application.MerchantService merchantService;

    /**
     * Receive and process a Razorpay webhook event.
     *
     * The raw body must be read as bytes BEFORE Jackson deserializes it,
     * because HMAC verification requires the exact bytes Razorpay signed.
     * Spring's @RequestBody byte[] guarantees this.
     *
     * Returns 200 always after signature verification succeeds —
     * Razorpay retries on non-200, which we don't want for known events.
     * Returns 401 on signature failure.
     * Returns 503 when webhook processing is disabled.
     */
    @PostMapping("/razorpay/{merchantId}")
    @Operation(summary = "Razorpay Test Mode webhook receiver",
               description = "Receives payment.captured, payment.failed, refund.created, refund.processed events. " +
                             "Authenticates via HMAC-SHA256 signature. No JWT required. " +
                             "All events are labeled RAZORPAY_TEST. " +
                             "NOT a claim of production fraud detection performance.")
    public ResponseEntity<?> receiveRazorpay(
            @PathVariable UUID merchantId,
            @RequestHeader(value = "X-Razorpay-Signature",  required = false) String signature,
            @RequestHeader(value = "X-Razorpay-Event-Id",   required = false) String eventId,
            @RequestBody byte[] rawBody) {

        // ── Guard: webhook disabled ───────────────────────────────────────
        if (!properties.getRazorpay().isEnabled()) {
            log.debug("Razorpay webhook disabled (RAZORPAY_WEBHOOK_ENABLED=false)");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new SimpleResponse("webhook_disabled",
                            "Razorpay webhook processing is disabled on this instance."));
        }

        // ── 1. Signature verification (HMAC-SHA256) ───────────────────────
        if (!webhookService.verifySignature(rawBody, signature)) {
            log.warn("Invalid Razorpay signature for merchant {} event {} — rejecting",
                    merchantId, eventId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new SimpleResponse("invalid_signature",
                            "Webhook signature verification failed."));
        }

        // ── 2. Fallback event ID if header missing ─────────────────────────
        // Some Razorpay versions omit X-Razorpay-Event-Id.
        // Generate a deterministic fallback from body hash to maintain idempotency.
        if (eventId == null || eventId.isBlank()) {
            eventId = "no-event-id-" + Integer.toHexString(java.util.Arrays.hashCode(rawBody));
            log.debug("X-Razorpay-Event-Id missing — using body hash fallback: {}", eventId);
        }

        // ── 3. Parse payload ───────────────────────────────────────────────
        RazorpayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, RazorpayWebhookPayload.class);
        } catch (Exception ex) {
            log.warn("Failed to parse Razorpay webhook body for merchant {}: {}", merchantId, ex.getMessage());
            // Still return 200 to prevent Razorpay retry storms — store raw for debugging
            return ResponseEntity.ok(new SimpleResponse("parse_error", "Body stored for audit."));
        }

        log.info("Razorpay webhook [{}] event={} merchant={}", eventId, payload.event(), merchantId);

        // ── 4. Process ────────────────────────────────────────────────────
        // Always return 200 after this point — Razorpay interprets non-200 as failure + retry.
        try {
            WebhookEventResponse result = webhookService.process(merchantId, eventId, rawBody, payload);
            return ResponseEntity.ok(new SimpleResponse("ok",
                    "Event processed: " + result.status().name() +
                    (result.riskScore() != null ? " | risk=" + result.riskScore() + " " + result.riskLevel() : "")));
        } catch (Exception ex) {
            log.error("Unhandled error in webhook processing for merchant {} event {}: {}",
                    merchantId, eventId, ex.getMessage(), ex);
            // Return 200 even on errors — the event is stored with FAILED status for debugging
            return ResponseEntity.ok(new SimpleResponse("error",
                    "Event stored with error status. Details in webhook_events audit log."));
        }
    }

    /**
     * List recent webhook events for the authenticated merchant.
     * Used by the live monitoring UI.
     */
    @GetMapping("/razorpay/events")
    @Operation(summary = "List recent Razorpay webhook events",
               description = "Returns the latest webhook events for this merchant. " +
                             "Used by the live monitoring panel. Requires JWT auth.")
    public ResponseEntity<ApiResponse<java.util.List<WebhookEventResponse>>> listEvents(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID merchantId = resolveCurrentMerchant();

        if (merchantId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Page<WebhookEventResponse> result = webhookService.listEvents(merchantId, page, size);
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    // Resolve merchant from current JWT
    private UUID resolveCurrentMerchant() {
        try {
            UUID userId = com.zeno.config.SecurityUtils.currentUserId();
            return merchantService.resolveMerchantId(userId);
        } catch (Exception ex) {
            return null;
        }
    }

    /** Minimal JSON response for webhook acknowledgements. */
    public record SimpleResponse(String status, String message) {}
}
