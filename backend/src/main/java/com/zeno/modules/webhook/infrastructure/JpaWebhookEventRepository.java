package com.zeno.modules.webhook.infrastructure;

import com.zeno.modules.webhook.domain.WebhookEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaWebhookEventRepository extends JpaRepository<WebhookEvent, UUID> {

    /** Idempotency check — returns existing event by Razorpay event ID. */
    Optional<WebhookEvent> findByMerchantIdAndRazorpayEventId(UUID merchantId, String razorpayEventId);

    /** List recent events for the live monitoring UI. */
    Page<WebhookEvent> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);

    /** Count by status for the dashboard. */
    long countByMerchantId(UUID merchantId);
    long countByMerchantIdAndEventType(UUID merchantId, String eventType);
}
