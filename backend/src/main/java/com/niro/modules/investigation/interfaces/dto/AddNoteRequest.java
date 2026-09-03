package com.niro.modules.investigation.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddNoteRequest(
        @NotBlank(message = "content is required")
        @Size(max = 2000)
        String content
) {}
