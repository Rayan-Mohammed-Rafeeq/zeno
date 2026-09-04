package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class UnauthorizedException extends ZenoException {

    public UnauthorizedException(String message) {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
    }

    public UnauthorizedException() {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required");
    }
}
