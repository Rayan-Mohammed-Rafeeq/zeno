package com.zeno.modules.customer.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.customer.application.CustomerService;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.customer.interfaces.dto.CustomerResponse;
import com.zeno.modules.customer.interfaces.dto.CustomerSummaryResponse;
import com.zeno.modules.customer.interfaces.dto.CustomerRiskDetailResponse;
import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AiAssessmentRepository;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.modules.ml.domain.MlPrediction;
import com.zeno.modules.ml.domain.MlPredictionRepository;
import com.zeno.modules.risk.domain.RiskAssessment;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.modules.risk.domain.RiskSignalEntity;
import com.zeno.modules.risk.domain.RiskSignalRepository;
import com.zeno.shared.api.ApiResponse;
import com.zeno.shared.api.PageMeta;
import com.zeno.shared.exception.ResourceNotFoundException;
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
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Customer management and risk detail")
public class CustomerController {

    private final CustomerService customerService;
    private final MerchantService merchantService;
    private final RiskAssessmentRepository riskAssessmentRepository;
    private final RiskSignalRepository riskSignalRepository;
    private final MlPredictionRepository mlPredictionRepository;
    private final AiAssessmentRepository aiAssessmentRepository;

    @GetMapping
    @Operation(summary = "List customers for the current merchant")
    public ResponseEntity<ApiResponse<java.util.List<CustomerSummaryResponse>>> list(
            @RequestParam(defaultValue = "0")      int            page,
            @RequestParam(defaultValue = "20")     int            size,
            @RequestParam(defaultValue = "createdAt") String      sort,
            @RequestParam(defaultValue = "desc")   String         direction,
            @RequestParam(required = false)        CustomerStatus status,
            @RequestParam(required = false)        String         search,
            @RequestParam(required = false)        String         riskLevel) {

        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Sort.Direction dir = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Page<CustomerSummaryResponse> result = customerService.listCustomers(
                merchantId, status, search, riskLevel,
                PageRequest.of(page, Math.min(size, 100), Sort.by(dir, sort)));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a customer by ID")
    public ResponseEntity<ApiResponse<CustomerSummaryResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(customerService.getCustomer(merchantId, id)));
    }

    /**
     * Combined risk detail for a customer: risk assessment + signals + ML prediction + SHAP + AI assessment.
     * This is the primary endpoint for the investigation/customer-detail view.
     *
     * Returns 404 if no risk assessment exists (run risk analysis first).
     * ML prediction and AI assessment sections are null when not yet generated.
     */
    @GetMapping("/{id}/risk-assessment")
    @Operation(summary = "Get combined risk detail for a customer",
               description = "Returns the latest risk assessment with signals, ML prediction with SHAP contributions, " +
                             "and the latest AI assessment if one has been generated. " +
                             "Run risk analysis first (/api/v1/risk/analyze) if this returns 404.")
    public ResponseEntity<ApiResponse<CustomerRiskDetailResponse>> getRiskDetail(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());

        RiskAssessment assessment = riskAssessmentRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No risk assessment found for customer " + id +
                        ". Run /api/v1/risk/analyze first."));

        List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(assessment.getId());

        MlPrediction mlPrediction = mlPredictionRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, id)
                .orElse(null);

        AiAssessmentEntity aiAssessment = aiAssessmentRepository
                .findTopByMerchantIdAndSubjectIdOrderByCreatedAtDesc(merchantId, id)
                .orElse(null);

        return ResponseEntity.ok(ApiResponse.of(
                CustomerRiskDetailResponse.from(assessment, signals, mlPrediction, aiAssessment)));
    }
}
