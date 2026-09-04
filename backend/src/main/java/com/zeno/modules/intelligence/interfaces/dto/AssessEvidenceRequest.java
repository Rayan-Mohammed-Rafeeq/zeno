package com.zeno.modules.intelligence.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssessEvidenceRequest(
        @NotBlank(message = "subjectType is required") String subjectType,
        @NotNull(message = "subjectId is required")   UUID subjectId,
        Integer clusterSize
) {}
