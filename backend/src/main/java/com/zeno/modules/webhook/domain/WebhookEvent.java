package com.zeno.modules.webhook.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable audit record of a received Razorpay webhook event.
 *
 * Created on receipt, updated when processing completes or fails.
 * Used for idempotency (unique on merchant_id + razorpay_event_id),
 * live monitoring UI, and audit trail.
 *
 * ALL rows from Test Mode have source=RAZORPAY_TEST.
 */
@Entity
@Table(name = "webhook_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "razorpay_event_id", nullable = false, length = 64)
    private String razorpayEventId;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> rawPayload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WebhookStatus status = WebhookStatus.RECEIVED;

    /** Internal Zeno payment ID created / found for this event. */
    @Column(name = "payment_id")
    private UUID paymentId;

    /** Internal Zeno refund ID created for this event. */
    @Column(name = "refund_id")
    private UUID refundId;

    @Column(name = "risk_score")
    private Integer riskScore;

    @Column(name = "risk_level", length = 10)
    private String riskLevel;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    /**
     * Source label — always RAZORPAY_TEST for Test Mode events.
     * Never omit or change this — it prevents misrepresentation of benchmark metrics.
     */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String source = "RAZORPAY_TEST";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
