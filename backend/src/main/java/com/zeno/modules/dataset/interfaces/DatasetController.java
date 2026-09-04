package com.zeno.modules.dataset.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.dataset.application.DatasetService;
import com.zeno.modules.dataset.interfaces.dto.DatasetRunResponse;
import com.zeno.modules.dataset.interfaces.dto.GenerateDatasetRequest;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/datasets")
@RequiredArgsConstructor
@Tag(name = "Dataset", description = "Synthetic dataset generation and management")
public class DatasetController {

    private final DatasetService datasetService;
    private final MerchantService merchantService;

    @PostMapping("/generate")
    @Operation(summary = "Generate a new synthetic dataset for evaluation",
               description = "Creates synthetic customers, payments, refunds, and hidden ground truth labels. " +
                             "All prior data for this merchant is replaced. Data is synthetic — not real customer records.")
    public ResponseEntity<ApiResponse<DatasetRunResponse>> generate(
            @Valid @RequestBody GenerateDatasetRequest request) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        DatasetRunResponse response = datasetService.generate(merchantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @GetMapping("/current")
    @Operation(summary = "Get the most recent dataset run for the current merchant")
    public ResponseEntity<ApiResponse<DatasetRunResponse>> current() {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(datasetService.getCurrentDataset(merchantId)));
    }
}
