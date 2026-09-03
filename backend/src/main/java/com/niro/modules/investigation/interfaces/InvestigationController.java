package com.niro.modules.investigation.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.investigation.application.InvestigationService;
import com.niro.modules.investigation.domain.InvestigationStatus;
import com.niro.modules.investigation.interfaces.dto.*;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
import com.niro.shared.api.PageMeta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/investigations")
@RequiredArgsConstructor
@Tag(name = "Investigations", description = "Analyst investigation workflow management")
public class InvestigationController {

    private final InvestigationService investigationService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List investigations for the current merchant")
    public ResponseEntity<ApiResponse<List<InvestigationResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) InvestigationStatus status) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Page<InvestigationResponse> result = investigationService.list(merchantId, status,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @PostMapping
    @Operation(summary = "Create a new investigation")
    public ResponseEntity<ApiResponse<InvestigationResponse>> create(
            @Valid @RequestBody CreateInvestigationRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        InvestigationResponse response = investigationService.create(merchantId, SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an investigation with its notes")
    public ResponseEntity<ApiResponse<InvestigationResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(investigationService.get(merchantId, id)));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update investigation status")
    public ResponseEntity<ApiResponse<InvestigationResponse>> updateStatus(
            @PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(investigationService.updateStatus(merchantId, id, request)));
    }

    @PostMapping("/{id}/notes")
    @Operation(summary = "Add an analyst note to an investigation")
    public ResponseEntity<ApiResponse<InvestigationResponse>> addNote(
            @PathVariable UUID id, @Valid @RequestBody AddNoteRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        InvestigationResponse response = investigationService.addNote(merchantId, id, SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }
}
