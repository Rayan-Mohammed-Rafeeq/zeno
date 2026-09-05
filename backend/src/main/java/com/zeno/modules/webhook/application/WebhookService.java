package com.zeno.modules.webhook.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.customer.infrastructure.JpaCustomerRepository;
import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentMethod;
import com.zeno.modules.payment.domain.PaymentStatus;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.domain.Refund;
import com.zeno.modules.refund.domain.RefundReason;
import com.zeno.modules.refund.domain.RefundStatus;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.modules.risk.application.RiskEngine;
import com.zeno.modules.risk.interfaces.dto.RiskAssessmentResponse;
import com.zeno.modules.webhook.domain.WebhookEvent;
import com.zeno.modules.webhook.domain.WebhookStatus;
import com.zeno.modules.webhook.infrastructure.JpaWebhookEventRepository;
import com.zeno.modules.webhook.interfaces.dto.RazorpayWebhookPayload;
import com.zeno.modules.webhook.interfaces.dto.WebhookEventResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Core webhook processing service.
 *
 * Flow for each incoming event:
 *   1. Verify HMAC-SHA256 signature  → reject if invalid (400)
 *   2. Idempotency check             → return DUPLICATE if already processed
 *   3. Store raw event               → audit trail
 *   4. Route by event type           → payment / refund handler
 *   5. Customer upsert               → find-or-create
 *   6. Payment persist               → idempotent save
 *   7. Refund persist (if applicable)
 *   8. Trigger RiskEngine.analyzeCustomer() → full ML + rules + graph
 *   9. Update webhook event record   → PROCESSED or FAILED
 *
 * DEFENSIVE DESIGN:
 * - RiskEngine failure never fails the webhook (graceful degradation).
 * - All DB writes are transactional; a failure rolls back the entire event.
 * - All events are labeled RAZORPAY_TEST — never claimed as production.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    private final ZenoProperties            properties;
    private final ObjectMapper              objectMapper;
    private final JpaWebhookEventRepository webhookRepo;
    private final JpaCustomerRepository     customerRepo;
    private final JpaPaymentRepository      paymentRepo;
    private final JpaRefundRepository       refundRepo;
    private final RiskEngine                riskEngine;

    // ─────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Verify the Razorpay webhook signature.
     *
     * Razorpay signs the raw request body with HMAC-SHA256 using the
     * webhook secret configured in the dashboard.
     * The signature is sent in the X-Razorpay-Signature header.
     *
     * Returns false (don't throw) so the controller can return 400/401
     * without leaking information about the rejection reason.
     */
    public boolean verifySignature(byte[] rawBody, String receivedSignature) {
        String secret = properties.getRazorpay().getWebhookSecret();
        if (secret == null || secret.isBlank() || secret.equals("your_razorpay_test_webhook_secret_here")) {
            log.warn("Razorpay webhook secret not configured — rejecting event");
            return false;
        }
        if (receivedSignature == null || receivedSignature.isBlank()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(rawBody);
            String computedHex = HexFormat.of().formatHex(computed);
            // Constant-time comparison to prevent timing attacks
            return MessageDigest.isEqual(
                    computedHex.getBytes(StandardCharsets.UTF_8),
                    receivedSignature.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            log.error("HMAC-SHA256 verification error: {}", ex.getMessage());
            return false;
        }
    }

    /**
     * Process a verified Razorpay webhook event.
     *
     * @param merchantId      Zeno internal merchant UUID (from URL path)
     * @param razorpayEventId Idempotency key from X-Razorpay-Event-Id header
     * @param rawBody         Raw request body bytes (for audit)
     * @param payload         Parsed Razorpay payload
     * @return processed WebhookEvent record
     */
    @Transactional
    public WebhookEventResponse process(
            UUID merchantId,
            String razorpayEventId,
            byte[] rawBody,
            RazorpayWebhookPayload payload) {

        // ── 1. Idempotency check ──────────────────────────────────────────
        var existing = webhookRepo.findByMerchantIdAndRazorpayEventId(merchantId, razorpayEventId);
        if (existing.isPresent()) {
            log.info("Duplicate webhook event {} for merchant {} — skipping", razorpayEventId, merchantId);
            var dup = existing.get();
            dup.setStatus(WebhookStatus.DUPLICATE);
            return WebhookEventResponse.from(webhookRepo.save(dup));
        }

        // ── 2. Parse raw body to Map for JSONB storage ────────────────────
        Map<String, Object> rawMap;
        try {
            rawMap = objectMapper.readValue(rawBody, new TypeReference<>() {});
        } catch (Exception ex) {
            rawMap = Map.of("parse_error", ex.getMessage(), "raw", new String(rawBody, StandardCharsets.UTF_8));
        }

        // ── 3. Persist initial audit record ───────────────────────────────
        WebhookEvent event = WebhookEvent.builder()
                .merchantId(merchantId)
                .razorpayEventId(razorpayEventId)
                .eventType(payload.event() != null ? payload.event() : "unknown")
                .rawPayload(rawMap)
                .status(WebhookStatus.RECEIVED)
                .source("RAZORPAY_TEST")
                .build();

        try {
            event = webhookRepo.save(event);
        } catch (DataIntegrityViolationException ex) {
            // Race condition — another thread already stored this event
            log.info("Concurrent duplicate for event {} — ignoring", razorpayEventId);
            return WebhookEventResponse.from(
                    webhookRepo.findByMerchantIdAndRazorpayEventId(merchantId, razorpayEventId)
                            .orElse(event));
        }

        // ── 4. Route by event type ────────────────────────────────────────
        String eventType = payload.event();
        if (eventType == null) {
            event.setStatus(WebhookStatus.IGNORED);
            event.setErrorMessage("Missing event type");
            return WebhookEventResponse.from(webhookRepo.save(event));
        }

        try {
            return switch (eventType) {
                case RazorpayWebhookPayload.EVENT_PAYMENT_CAPTURED ->
                        handlePaymentCaptured(merchantId, event, payload);
                case RazorpayWebhookPayload.EVENT_PAYMENT_FAILED ->
                        handlePaymentFailed(merchantId, event, payload);
                case RazorpayWebhookPayload.EVENT_REFUND_CREATED,
                     RazorpayWebhookPayload.EVENT_REFUND_PROCESSED ->
                        handleRefund(merchantId, event, payload);
                default -> {
                    log.debug("Unhandled event type: {} — stored for audit", eventType);
                    event.setStatus(WebhookStatus.IGNORED);
                    yield WebhookEventResponse.from(webhookRepo.save(event));
                }
            };
        } catch (Exception ex) {
            log.error("Error processing webhook event {} ({}): {}", razorpayEventId, eventType, ex.getMessage(), ex);
            event.setStatus(WebhookStatus.FAILED);
            event.setErrorMessage(ex.getMessage() != null
                    ? ex.getMessage().substring(0, Math.min(500, ex.getMessage().length()))
                    : "Unknown error");
            return WebhookEventResponse.from(webhookRepo.save(event));
        }
    }

    /**
     * List recent webhook events for a merchant (live monitoring UI).
     */
    @Transactional(readOnly = true)
    public Page<WebhookEventResponse> listEvents(UUID merchantId, int page, int size) {
        return webhookRepo.findByMerchantIdOrderByCreatedAtDesc(
                        merchantId,
                        PageRequest.of(page, Math.min(size, 50),
                                Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(WebhookEventResponse::from);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Event handlers
    // ─────────────────────────────────────────────────────────────────────

    private WebhookEventResponse handlePaymentCaptured(
            UUID merchantId, WebhookEvent event, RazorpayWebhookPayload payload) {

        RazorpayWebhookPayload.PaymentEntity p = payload.paymentEntity();
        if (p == null || p.id() == null) {
            event.setStatus(WebhookStatus.FAILED);
            event.setErrorMessage("payment.captured event missing payment entity");
            return WebhookEventResponse.from(webhookRepo.save(event));
        }

        // Idempotent payment upsert
        Payment payment = upsertPayment(merchantId, p, PaymentStatus.SUCCESS);
        event.setPaymentId(payment.getId());

        // Risk scoring — never fails the webhook
        triggerRiskAnalysis(merchantId, payment.getCustomerId(), event);

        event.setStatus(WebhookStatus.PROCESSED);
        return WebhookEventResponse.from(webhookRepo.save(event));
    }

    private WebhookEventResponse handlePaymentFailed(
            UUID merchantId, WebhookEvent event, RazorpayWebhookPayload payload) {

        RazorpayWebhookPayload.PaymentEntity p = payload.paymentEntity();
        if (p == null || p.id() == null) {
            event.setStatus(WebhookStatus.IGNORED);
            return WebhookEventResponse.from(webhookRepo.save(event));
        }

        Payment payment = upsertPayment(merchantId, p, PaymentStatus.FAILED);
        event.setPaymentId(payment.getId());

        // Still score — failed payments can be part of velocity abuse patterns
        triggerRiskAnalysis(merchantId, payment.getCustomerId(), event);

        event.setStatus(WebhookStatus.PROCESSED);
        return WebhookEventResponse.from(webhookRepo.save(event));
    }

    private WebhookEventResponse handleRefund(
            UUID merchantId, WebhookEvent event, RazorpayWebhookPayload payload) {

        RazorpayWebhookPayload.RefundEntity r = payload.refundEntity();
        if (r == null || r.id() == null || r.paymentId() == null) {
            event.setStatus(WebhookStatus.IGNORED);
            event.setErrorMessage("Refund event missing required fields");
            return WebhookEventResponse.from(webhookRepo.save(event));
        }

        // Resolve the payment this refund belongs to
        Payment payment = paymentRepo
                .findByMerchantIdAndExternalPaymentId(merchantId, r.paymentId())
                .orElse(null);

        if (payment == null) {
            // Payment not yet ingested — this can happen if payment.captured was missed.
            // We can't create a refund without a payment, so log and continue.
            log.warn("Refund {} references unknown payment {} for merchant {}",
                    r.id(), r.paymentId(), merchantId);
            event.setStatus(WebhookStatus.IGNORED);
            event.setErrorMessage("Parent payment " + r.paymentId() + " not found in Zeno");
            return WebhookEventResponse.from(webhookRepo.save(event));
        }

        // Idempotent refund upsert
        Refund refund = upsertRefund(merchantId, r, payment);
        event.setRefundId(refund.getId());
        event.setPaymentId(payment.getId());

        // Re-score customer — refund is the primary signal
        triggerRiskAnalysis(merchantId, payment.getCustomerId(), event);

        event.setStatus(WebhookStatus.PROCESSED);
        return WebhookEventResponse.from(webhookRepo.save(event));
    }

    // ─────────────────────────────────────────────────────────────────────
    // Customer upsert
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Find-or-create a Customer for this merchant based on the Razorpay payment entity.
     * Uses externalCustomerId as the idempotency key.
     * Never overwrites an existing customer's data.
     */
    private Customer upsertCustomer(UUID merchantId, RazorpayWebhookPayload.PaymentEntity p) {
        String externalKey = p.resolvedCustomerKey();

        return customerRepo.findByMerchantIdAndExternalCustomerId(merchantId, externalKey)
                .orElseGet(() -> {
                    Customer c = Customer.builder()
                            .merchantId(merchantId)
                            .externalCustomerId(externalKey)
                            .accountAgeDays(0)
                            .status(CustomerStatus.ACTIVE)
                            .country(p.international() != null && p.international() ? "INT" : "IN")
                            .syntheticProfileType("LIVE_RAZORPAY_TEST")
                            .build();
                    Customer saved = customerRepo.save(c);
                    log.info("Created new customer {} for merchant {} from Razorpay event",
                            saved.getId(), merchantId);
                    return saved;
                });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Payment upsert
    // ─────────────────────────────────────────────────────────────────────

    private Payment upsertPayment(UUID merchantId,
                                   RazorpayWebhookPayload.PaymentEntity p,
                                   PaymentStatus status) {
        // Check idempotency
        return paymentRepo.findByMerchantIdAndExternalPaymentId(merchantId, p.id())
                .orElseGet(() -> {
                    Customer customer = upsertCustomer(merchantId, p);

                    Payment payment = Payment.builder()
                            .merchantId(merchantId)
                            .customerId(customer.getId())
                            .externalPaymentId(p.id())
                            .amount(p.amountInMajorUnit())
                            .currency(p.currency() != null ? p.currency() : "INR")
                            .timestamp(p.createdAt() != null
                                    ? Instant.ofEpochSecond(p.createdAt())
                                    : Instant.now())
                            .status(status)
                            .paymentMethod(mapMethod(p.method()))
                            // Razorpay does not expose device_id directly —
                            // we derive a stable fingerprint from VPA / card_id / bank for signal detection
                            .deviceId(deriveDeviceFingerprint(p))
                            .ipAddress(null)  // Razorpay webhooks do not include customer IP
                            .addressFingerprint(null)
                            .build();

                    Payment saved = paymentRepo.saveAndFlush(payment);
                    log.info("Ingested payment {} (Razorpay {}) for customer {} merchant {}",
                            saved.getId(), p.id(), customer.getId(), merchantId);
                    return saved;
                });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Refund upsert
    // ─────────────────────────────────────────────────────────────────────

    private Refund upsertRefund(UUID merchantId,
                                 RazorpayWebhookPayload.RefundEntity r,
                                 Payment payment) {
        // Idempotency via external_refund_id
        return refundRepo.findByMerchantIdAndExternalRefundId(merchantId, r.id())
                .orElseGet(() -> {
                    Refund refund = Refund.builder()
                            .merchantId(merchantId)
                            .paymentId(payment.getId())
                            .customerId(payment.getCustomerId())
                            .externalRefundId(r.id())
                            .amount(r.amountInMajorUnit())
                            .reason(RefundReason.CUSTOMER_REQUEST)
                            .status(mapRefundStatus(r.status()))
                            .requestedAt(r.createdAt() != null
                                    ? Instant.ofEpochSecond(r.createdAt())
                                    : Instant.now())
                            .completedAt("processed".equalsIgnoreCase(r.status()) ? Instant.now() : null)
                            .build();

                    Refund saved = refundRepo.save(refund);
                    log.info("Ingested refund {} (Razorpay {}) for payment {} merchant {}",
                            saved.getId(), r.id(), payment.getId(), merchantId);
                    return saved;
                });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Risk trigger — graceful degradation
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Trigger RiskEngine.analyzeCustomer() for the customer affected by this event.
     * Any failure is caught and logged — it must never fail the webhook response.
     * The event's riskScore / riskLevel fields are updated with the result.
     */
    private void triggerRiskAnalysis(UUID merchantId, UUID customerId, WebhookEvent event) {
        try {
            RiskAssessmentResponse assessment = riskEngine.analyzeCustomer(merchantId, customerId);
            event.setRiskScore(assessment.riskScore());
            event.setRiskLevel(assessment.riskLevel().name());
            log.info("Risk analysis complete for customer {} (merchant {}): score={} level={}",
                    customerId, merchantId, assessment.riskScore(), assessment.riskLevel());
        } catch (Exception ex) {
            // Risk failure must never fail the webhook
            log.warn("Risk analysis failed for customer {} — webhook still acknowledged: {}",
                    customerId, ex.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private PaymentMethod mapMethod(String method) {
        if (method == null) return PaymentMethod.OTHER;
        return switch (method.toLowerCase()) {
            case RazorpayWebhookPayload.METHOD_CARD       -> PaymentMethod.CARD;
            case RazorpayWebhookPayload.METHOD_UPI        -> PaymentMethod.UPI;
            case RazorpayWebhookPayload.METHOD_NETBANKING -> PaymentMethod.NETBANKING;
            case RazorpayWebhookPayload.METHOD_WALLET     -> PaymentMethod.WALLET;
            default -> PaymentMethod.OTHER;
        };
    }

    private RefundStatus mapRefundStatus(String status) {
        if (status == null) return RefundStatus.PENDING;
        return switch (status.toLowerCase()) {
            case "processed" -> RefundStatus.COMPLETED;
            case "failed"    -> RefundStatus.REJECTED;
            default          -> RefundStatus.PENDING;
        };
    }

    /**
     * Derive a stable device-like fingerprint from Razorpay payment fields.
     * Used for device-reuse signal detection.
     * Priority: VPA (UPI, very stable) → card_id → bank → wallet → null.
     */
    private String deriveDeviceFingerprint(RazorpayWebhookPayload.PaymentEntity p) {
        if (p.vpa()    != null && !p.vpa().isBlank())    return "vpa:"    + p.vpa().toLowerCase().trim();
        if (p.cardId() != null && !p.cardId().isBlank()) return "card:"   + p.cardId();
        if (p.bank()   != null && !p.bank().isBlank())   return "bank:"   + p.bank().toUpperCase();
        if (p.wallet() != null && !p.wallet().isBlank()) return "wallet:" + p.wallet().toLowerCase();
        return null;
    }
}
