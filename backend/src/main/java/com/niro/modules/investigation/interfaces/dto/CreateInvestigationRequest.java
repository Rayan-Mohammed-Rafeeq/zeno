package com.niro.modules.investigation.interfaces.dto;

import com.niro.modules.investigation.domain.SubjectType;
import com.niro.modules.risk.domain.RiskLevel;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateInvestigationRequest(
        @NotNull(message = "subjectType is required") SubjectType subjectType,
        @NotNull(message = "subjectId is required")   UUID subjectId,
        @NotNull(message = "riskLevel is required")   RiskLevel riskLevel,
        UUID assignedTo
) {}
