package com.zeno.modules.investigation.interfaces.dto;

import com.zeno.modules.investigation.domain.InvestigationStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "status is required") InvestigationStatus status
) {}
