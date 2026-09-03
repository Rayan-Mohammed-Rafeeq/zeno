package com.niro.modules.evaluation.interfaces;

import com.niro.config.SecurityUtils;
import com.niro.modules.evaluation.application.EvaluationService;
import com.niro.modules.evaluation.interfaces.dto.EvaluationMetricsResponse;
import com.niro.modules.evaluation.interfaces.dto.EvaluationRunResponse;
import com.niro.modules.evaluation.interfaces.dto.FalsePositiveCaseResponse;
import com.niro.modules.evaluation.interfaces.dto.SignalPerformanceResponse;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
               description = "Computes precision, recall, F1, FPR, FNR and false-positive cost. " +
                             "Ground truth is never exposed to the detector — evaluation only. " +
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

    /**
     * GET /evaluation/metrics
     * Returns flat aggregate metrics matching the frontend EvaluationMetrics TypeScript type.
     */
    @GetMapping("/metrics")
    @Operation(summary = "Get flat evaluation metrics for the frontend dashboard",
               description = "Returns datasetSize, positiveCases, precision, recall, F1, FPR, " +
                             "falsePositiveCost. All values are MODEL ESTIMATES on synthetic data.")
    public ResponseEntity<ApiResponse<EvaluationMetricsResponse>> metrics() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(evaluationService.getMetrics(merchantId)));
    }

    /**
     * GET /evaluation/signals
     * Returns per-signal precision, recall, FP count, and contribution percentage.
     */
    @GetMapping("/signals")
    @Operation(summary = "Get per-signal performance breakdown",
               description = "Returns precision, recall, FP count and contribution for each " +
                             "risk signal type. Used by the evaluation radar chart and signal table.")
    public ResponseEntity<ApiResponse<List<SignalPerformanceResponse>>> signals() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(evaluationService.getSignalPerformance(merchantId)));
    }

    /**
     * GET /evaluation/false-positives
     * Returns up to 20 false-positive examples for error analysis.
     */
    @GetMapping("/false-positives")
    @Operation(summary = "Get false-positive examples for error analysis",
               description = "Returns customers predicted HIGH/CRITICAL who are actually LEGITIMATE " +
                             "according to hidden ground truth labels. Up to 20 examples with reasons.")
    public ResponseEntity<ApiResponse<List<FalsePositiveCaseResponse>>> falsePositives() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(evaluationService.getFalsePositives(merchantId)));
    }
}
