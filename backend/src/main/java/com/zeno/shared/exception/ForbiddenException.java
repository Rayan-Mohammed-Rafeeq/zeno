package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends ZenoException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    public ForbiddenException() {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", "Access denied");
    }
}
