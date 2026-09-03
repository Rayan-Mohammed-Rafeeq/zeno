package com.niro.shared.exception;

import org.springframework.http.HttpStatus;

/**
 * Base exception for all Niro domain and application errors.
 */
public class NiroException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public NiroException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public NiroException(HttpStatus status, String code, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
