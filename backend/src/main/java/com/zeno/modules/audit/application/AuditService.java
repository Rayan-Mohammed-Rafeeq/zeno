package com.zeno.modules.audit.application;

import com.zeno.modules.audit.domain.AuditEvent;
import com.zeno.modules.audit.domain.AuditEventRepository;
import com.zeno.modules.audit.domain.AuditEventType;
import com.zeno.modules.audit.interfaces.dto.AuditEventResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditEventRepository auditEventRepository;

    /**
     * Record an audit event. Called asynchronously from application services so it
     * never blocks the main transaction. Uses REQUIRES_NEW so audit persists even
     * if the calling transaction rolls back.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID merchantId, UUID actorId, String actorType,
                       AuditEventType eventType, String entityType, UUID entityId,
                       Map<String, Object> metadata) {
        try {
            AuditEvent event = AuditEvent.builder()
                    .merchantId(merchantId)
                    .actorId(actorId)
                    .actorType(actorType)
                    .eventType(eventType)
                    .entityType(entityType)
                    .entityId(entityId)
                    .metadata(metadata)
                    .build();
            auditEventRepository.save(event);
        } catch (Exception ex) {
            // Audit must never break the calling flow
            log.error("Failed to record audit event {}: {}", eventType, ex.getMessage());
        }
    }

    /** Convenience overload for system events with no actor */
    public void recordSystem(UUID merchantId, AuditEventType eventType,
                             String entityType, UUID entityId, Map<String, Object> metadata) {
        record(merchantId, null, "SYSTEM", eventType, entityType, entityId, metadata);
    }

    @Transactional(readOnly = true)
    public Page<AuditEventResponse> list(UUID merchantId, AuditEventType eventType, Pageable pageable) {
        Page<AuditEvent> page = (eventType != null)
                ? auditEventRepository.findByMerchantIdAndEventType(merchantId, eventType, pageable)
                : auditEventRepository.findByMerchantId(merchantId, pageable);
        return page.map(AuditEventResponse::from);
    }
}
