package com.niro.modules.risk.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.modules.risk.application.RiskEngine;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.interfaces.dto.AnalyzeRequest;
import com.niro.modules.risk.interfaces.dto.RiskAssessmentResponse;
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
@RequestMapping("/api/v1/risk")
@RequiredArgsConstructor
@Tag(name = "Risk", description = "Deterministic risk signal detection and assessment engine")
public class RiskController {

    private final RiskEngine riskEngine;
    private final MerchantService merchantService;

    @PostMapping("/analyze")
    @Operation(summary = "Run risk analysis",
               description = "If customerId is provided, analyzes that customer only. " +
                             "Otherwise runs a full scan of all customers for the merchant. " +
                             "Risk scores are based on deterministic signals — not LLM inference.")
    public ResponseEntity<ApiResponse<Object>> analyze(
            @RequestBody(required = false) AnalyzeRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());

        if (request != null && request.customerId() != null) {
            RiskAssessmentResponse result = riskEngine.analyzeCustomer(merchantId, request.customerId());
            return ResponseEntity.ok(ApiResponse.of(result));
        } else {
            List<RiskAssessmentResponse> results = riskEngine.analyzeAllCustomers(merchantId);
            return ResponseEntity.ok(ApiResponse.of(results,
                    java.util.Map.of("assessed", results.size())));
        }
    }

    @GetMapping("/assessments")
    @Operation(summary = "List all risk assessments for the current merchant")
    public ResponseEntity<ApiResponse<List<RiskAssessmentResponse>>> listAssessments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) RiskLevel level) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Page<RiskAssessmentResponse> result = riskEngine.listAssessments(
                merchantId, level, PageRequest.of(page, Math.min(size, 100),
                        Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/assessments/{id}")
    @Operation(summary = "Get a single risk assessment with all signals")
    public ResponseEntity<ApiResponse<RiskAssessmentResponse>> getAssessment(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(riskEngine.getAssessment(merchantId, id)));
    }
}
