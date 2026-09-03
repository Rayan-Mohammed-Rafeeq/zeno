package com.niro.modules.audit.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.audit.application.AuditService;
import com.niro.modules.audit.domain.AuditEventType;
import com.niro.modules.audit.interfaces.dto.AuditEventResponse;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
import com.niro.shared.api.PageMeta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit-events")
@RequiredArgsConstructor
@Tag(name = "Audit", description = "Immutable audit trail for all system events")
public class AuditController {

    private final AuditService auditService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List audit events for the current merchant")
    public ResponseEntity<ApiResponse<List<AuditEventResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) AuditEventType eventType) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Page<AuditEventResponse> result = auditService.list(merchantId, eventType,
                PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "timestamp")));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }
}
