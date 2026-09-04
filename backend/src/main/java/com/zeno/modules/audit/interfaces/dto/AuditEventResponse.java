package com.zeno.modules.audit.interfaces.dto;

import com.zeno.modules.audit.domain.AuditEvent;
import com.zeno.modules.audit.domain.AuditEventType;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AuditEventResponse(
        UUID id,
        UUID merchantId,
        String actorType,
        UUID actorId,
        AuditEventType eventType,
        String entityType,
        UUID entityId,
        Map<String, Object> metadata,
        Instant timestamp
) {
    public static AuditEventResponse from(AuditEvent e) {
        return new AuditEventResponse(
                e.getId(), e.getMerchantId(), e.getActorType(), e.getActorId(),
                e.getEventType(), e.getEntityType(), e.getEntityId(),
                e.getMetadata(), e.getTimestamp());
    }
}
