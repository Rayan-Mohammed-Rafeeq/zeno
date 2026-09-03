package com.niro.modules.evaluation.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.evaluation.application.EvaluationService;
import com.niro.modules.evaluation.interfaces.dto.EvaluationRunResponse;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/evaluation")
@RequiredArgsConstructor
@Tag(name = "Evaluation", description = "Detector evaluation against hidden ground truth labels")
public class EvaluationController {

    private final EvaluationService evaluationService;
    private final MerchantService merchantService;

    @PostMapping("/run")
    @Operation(summary = "Run evaluation against hidden ground truth",
               description = "Computes precision, recall, F1, FPR, FNR and false-positive cost " +
                             "by comparing risk assessments against hidden ground truth labels. " +
                             "Ground truth is never exposed to the detector — only used here for evaluation. " +
                             "All metrics are based on synthetic data.")
    public ResponseEntity<ApiResponse<EvaluationRunResponse>> run() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(evaluationService.runEvaluation(merchantId)));
    }

    @GetMapping("/latest")
    @Operation(summary = "Get the most recent evaluation run")
    public ResponseEntity<ApiResponse<EvaluationRunResponse>> latest() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(evaluationService.getLatest(merchantId)));
    }
}
