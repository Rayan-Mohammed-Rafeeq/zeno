package com.zeno.modules.decision.interfaces.dto;

import com.zeno.modules.decision.domain.DecisionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RecommendRequest(
        @NotBlank(message = "subjectType is required") String subjectType,
        @NotNull(message = "subjectId is required")    UUID subjectId,
        /** Optional analyst override of the policy recommendation */
        DecisionType overrideDecision,
        String overrideReason
) {}
