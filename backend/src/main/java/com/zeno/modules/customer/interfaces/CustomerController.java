package com.zeno.modules.customer.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.customer.application.CustomerService;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.customer.interfaces.dto.CustomerResponse;
import com.zeno.modules.merchant.application.MerchantService;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Synthetic customer management")
public class CustomerController {

    private final CustomerService customerService;
    private final MerchantService merchantService;

    @GetMapping
    @Operation(summary = "List customers for the current merchant")
    public ResponseEntity<ApiResponse<java.util.List<CustomerResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) CustomerStatus status) {

        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        Sort.Direction dir = Sort.Direction.fromOptionalString(direction).orElse(Sort.Direction.DESC);
        Page<CustomerResponse> result = customerService.listCustomers(
                merchantId, status, PageRequest.of(page, Math.min(size, 100), Sort.by(dir, sort)));
        return ResponseEntity.ok(ApiResponse.of(result.getContent(), PageMeta.from(result)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a customer by ID")
    public ResponseEntity<ApiResponse<CustomerResponse>> get(@PathVariable UUID id) {
        UUID merchantId = merchantService.resolveMerchantId(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(customerService.getCustomer(merchantId, id)));
    }
}
