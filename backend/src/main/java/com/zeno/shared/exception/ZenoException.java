package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

/**
 * Base exception for all Zeno domain and application errors.
 */
public class ZenoException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ZenoException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public ZenoException(HttpStatus status, String code, String message, Throwable cause) {
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
