package com.zeno.modules.investigation.interfaces.dto;

import com.zeno.modules.investigation.domain.SubjectType;
import com.zeno.modules.risk.domain.RiskLevel;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateInvestigationRequest(
        @NotNull(message = "subjectType is required") SubjectType subjectType,
        @NotNull(message = "subjectId is required")   UUID subjectId,
        @NotNull(message = "riskLevel is required")   RiskLevel riskLevel,
        UUID assignedTo
) {}
