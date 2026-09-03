package com.niro.shared.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends NiroException {

    public ConflictException(String code, String message) {
        super(HttpStatus.CONFLICT, code, message);
    }
}
