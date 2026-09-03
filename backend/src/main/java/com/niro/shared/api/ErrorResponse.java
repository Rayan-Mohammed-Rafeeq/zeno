package com.niro.shared.api;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<FieldError> errors
) {
    public record FieldError(String field, String message) {}

    public static ErrorResponse of(int status, String code, String message) {
        return new ErrorResponse(Instant.now(), status, code, message, null);
    }

    public static ErrorResponse of(int status, String code, String message, List<FieldError> errors) {
        return new ErrorResponse(Instant.now(), status, code, message, errors);
    }
}
