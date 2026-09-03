package com.niro.modules.refund.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.modules.refund.application.RefundService;
import com.niro.modules.refund.interfaces.dto.RefundResponse;
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
@RequestMapping("/api/v1/refunds")
@RequiredArgsConstructor
@Tag(name = "Refunds", description = "Synthetic refund management")
public class RefundController {

    private final RefundService refundService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List refunds for the current merchant")
    public ResponseEntity<ApiResponse<List<RefundResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "requestedAt") String sort,
            @RequestParam(defaultValue = "desc") String direction) {

        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Sort.Direction dir = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Page<RefundResponse> result = refundService.listRefunds(
                merchantId, PageRequest.of(page, Math.min(size, 100), Sort.by(dir, sort)));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a refund by ID")
    public ResponseEntity<ApiResponse<RefundResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(refundService.getRefund(merchantId, id)));
    }
}
