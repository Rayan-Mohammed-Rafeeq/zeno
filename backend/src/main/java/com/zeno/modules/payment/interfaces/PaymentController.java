package com.zeno.modules.payment.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.modules.payment.application.PaymentService;
import com.zeno.modules.payment.interfaces.dto.TransactionSummaryResponse;
import com.zeno.shared.api.ApiResponse;
import com.zeno.shared.api.PageMeta;
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
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Synthetic payment transaction management")
public class PaymentController {

    private final PaymentService  paymentService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List payments for the current merchant",
               description = "Returns enriched transaction summaries including refund status, " +
                             "risk score/level from the latest risk assessment, signal count, " +
                             "and customer display name.")
    public ResponseEntity<ApiResponse<List<TransactionSummaryResponse>>> list(
            @RequestParam(defaultValue = "0")         int    page,
            @RequestParam(defaultValue = "20")        int    size,
            @RequestParam(defaultValue = "timestamp") String sort,
            @RequestParam(defaultValue = "desc")      String direction,
            @RequestParam(required = false)           String search,
            @RequestParam(required = false)           String riskLevel,
            @RequestParam(required = false)           UUID   customerId) {

        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Sort.Direction dir = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Page<TransactionSummaryResponse> result = paymentService.listPayments(
                merchantId, search, riskLevel, customerId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(dir, sort)));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a payment by ID",
               description = "Returns an enriched transaction summary for a single payment.")
    public ResponseEntity<ApiResponse<TransactionSummaryResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(paymentService.getPayment(merchantId, id)));
    }
}
