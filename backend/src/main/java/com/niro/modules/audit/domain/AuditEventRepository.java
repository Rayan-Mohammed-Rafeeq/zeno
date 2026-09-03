package com.niro.modules.audit.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AuditEventRepository {
    AuditEvent save(AuditEvent event);
    Page<AuditEvent> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<AuditEvent> findByMerchantIdAndEventType(UUID merchantId, AuditEventType eventType, Pageable pageable);
}
