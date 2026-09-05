package com.zeno.modules.webhook.domain;

public enum WebhookStatus {
    RECEIVED,      // Stored but not yet processed
    PROCESSED,     // Successfully ingested — payment/refund created, risk scored
    DUPLICATE,     // Idempotency hit — event already processed
    IGNORED,       // Event type not handled (e.g. order.paid)
    FAILED         // Processing error — check error_message
}
