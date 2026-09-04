package com.zeno.modules.payment.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.modules.payment.application.PaymentService;
import com.zeno.modules.payment.interfaces.dto.PaymentResponse;
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

    private final PaymentService paymentService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List payments for the current merchant")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "timestamp") String sort,
            @RequestParam(defaultValue = "desc") String direction) {

        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Sort.Direction dir = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Page<PaymentResponse> result = paymentService.listPayments(
                merchantId, PageRequest.of(page, Math.min(size, 100), Sort.by(dir, sort)));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a payment by ID")
    public ResponseEntity<ApiResponse<PaymentResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(paymentService.getPayment(merchantId, id)));
    }
}
