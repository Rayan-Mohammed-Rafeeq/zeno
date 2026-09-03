package com.niro.modules.intelligence.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.intelligence.application.IntelligenceService;
import com.niro.modules.intelligence.interfaces.dto.AiAssessmentResponse;
import com.niro.modules.intelligence.interfaces.dto.AssessEvidenceRequest;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
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

    @PostMapping("/assess")
    @Operation(summary = "Request an AI evidence assessment",
               description = "Assembles an evidence bundle from risk signals and requests an AI interpretation. " +
                             "The AI is an evidence interpreter, NOT the fraud detector. " +
                             "All assessments are advisory and require analyst review.")
    public ResponseEntity<ApiResponse<AiAssessmentResponse>> assess(
            @Valid @RequestBody AssessEvidenceRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        AiAssessmentResponse response = intelligenceService.assessCustomer(merchantId, request);
        return ResponseEntity.ok(ApiResponse.of(response));
    }
}
