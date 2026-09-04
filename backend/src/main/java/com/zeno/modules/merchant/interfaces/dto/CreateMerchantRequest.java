package com.zeno.modules.merchant.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMerchantRequest(
        @NotBlank(message = "Merchant name is required")
        @Size(min = 2, max = 100)
        String name
) {}
