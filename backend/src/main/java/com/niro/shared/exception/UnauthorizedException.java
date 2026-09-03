package com.niro.shared.exception;

import org.springframework.http.HttpStatus;

public class UnauthorizedException extends NiroException {

    public UnauthorizedException(String message) {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
    }

    public UnauthorizedException() {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required");
    }
}
