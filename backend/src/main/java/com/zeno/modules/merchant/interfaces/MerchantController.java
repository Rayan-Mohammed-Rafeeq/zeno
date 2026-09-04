package com.zeno.modules.merchant.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.modules.merchant.interfaces.dto.CreateMerchantRequest;
import com.zeno.modules.merchant.interfaces.dto.MerchantResponse;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/merchants")
@RequiredArgsConstructor
@Tag(name = "Merchant", description = "Merchant management")
public class MerchantController {

    private final MerchantService merchantService;

    @PostMapping
    @Operation(summary = "Create a merchant and associate with the current user")
    public ResponseEntity<ApiResponse<MerchantResponse>> create(
            @Valid @RequestBody CreateMerchantRequest request) {
        MerchantResponse response = merchantService.createMerchant(
                SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @GetMapping("/me")
    @Operation(summary = "Get the merchant associated with the current user")
    public ResponseEntity<ApiResponse<MerchantResponse>> getMyMerchant() {
        MerchantResponse response = merchantService.getMerchantForUser(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }
}
