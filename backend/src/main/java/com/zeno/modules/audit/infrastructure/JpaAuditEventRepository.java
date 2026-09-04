package com.zeno.modules.audit.infrastructure;

import com.zeno.modules.audit.domain.AuditEvent;
import com.zeno.modules.audit.domain.AuditEventRepository;
import com.zeno.modules.audit.domain.AuditEventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface JpaAuditEventRepository extends JpaRepository<AuditEvent, UUID>, AuditEventRepository {
    Page<AuditEvent> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<AuditEvent> findByMerchantIdAndEventType(UUID merchantId, AuditEventType eventType, Pageable pageable);
}
