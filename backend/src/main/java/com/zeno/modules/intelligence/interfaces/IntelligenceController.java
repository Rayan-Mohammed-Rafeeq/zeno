package com.zeno.modules.intelligence.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.intelligence.application.IntelligenceService;
import com.zeno.modules.intelligence.interfaces.dto.AiAssessmentResponse;
import com.zeno.modules.intelligence.interfaces.dto.AssessEvidenceRequest;
import com.zeno.modules.intelligence.interfaces.dto.ChargebackEvidenceRequest;
import com.zeno.modules.intelligence.interfaces.dto.ChargebackEvidenceResponse;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/intelligence")
@RequiredArgsConstructor
@Tag(name = "Intelligence", description = "AI-assisted evidence interpretation (advisory only)")
public class IntelligenceController {

    private final IntelligenceService intelligenceService;
    private final MerchantService merchantService;

    /**
     * Generate an AI evidence assessment for a customer.
     *
     * The AI receives a structured evidence bundle containing only observable data:
     * risk score, rule-based signals, ML fraud probability, SHAP contributors,
     * and graph/cluster evidence. It synthesizes these into a structured JSON assessment.
     *
     * The assessment is advisory only. It does not establish fraud.
     * A human analyst must review before any action is taken.
     */
    @PostMapping("/assess")
    @Operation(summary = "Request an AI evidence assessment",
               description = "Assembles an evidence bundle from risk signals, ML predictions, SHAP values, " +
                             "and graph evidence, then requests an AI interpretation. " +
                             "The AI is an evidence interpreter, NOT the fraud detector. " +
                             "All assessments are advisory and require analyst review.")
    public ResponseEntity<ApiResponse<AiAssessmentResponse>> assess(
            @Valid @RequestBody AssessEvidenceRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        AiAssessmentResponse response = intelligenceService.assessCustomer(merchantId, request);
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    /**
     * Prepare a defensive chargeback/dispute evidence package for a customer.
     *
     * This is a DEFENSIVE tool only — it organizes existing evidence to help
     * merchants respond to disputes. It does NOT help circumvent dispute processes
     * or make false claims.
     *
     * The output is labeled as AI-generated and requires analyst verification.
     */
    @PostMapping("/chargeback-evidence")
    @Operation(summary = "Generate a defensive chargeback evidence package",
               description = "Assembles observable evidence (transactions, refunds, risk signals, ML probability, " +
                             "SHAP drivers, network/cluster relationships) into a structured merchant-facing " +
                             "evidence package for dispute/chargeback review. " +
                             "DEFENSIVE USE ONLY. Analyst verification required before use in any dispute process.")
    public ResponseEntity<ApiResponse<ChargebackEvidenceResponse>> chargebackEvidence(
            @Valid @RequestBody ChargebackEvidenceRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        ChargebackEvidenceResponse response = intelligenceService.buildChargebackEvidence(merchantId, request);
        return ResponseEntity.ok(ApiResponse.of(response));
    }
}
