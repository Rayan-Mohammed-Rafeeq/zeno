package com.zeno.modules.dataset.interfaces.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record GenerateDatasetRequest(
        @NotNull(message = "recordCount is required")
        @Min(value = 10, message = "recordCount must be at least 10")
        @Max(value = 5000, message = "recordCount must not exceed 5000")
        Integer recordCount,

        Long seed
) {}
