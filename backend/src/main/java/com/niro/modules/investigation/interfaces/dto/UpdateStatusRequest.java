package com.niro.modules.investigation.interfaces.dto;

import com.niro.modules.investigation.domain.InvestigationStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "status is required") InvestigationStatus status
) {}
