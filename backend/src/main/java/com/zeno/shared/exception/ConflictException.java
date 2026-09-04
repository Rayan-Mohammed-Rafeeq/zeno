package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends ZenoException {

    public ConflictException(String code, String message) {
        super(HttpStatus.CONFLICT, code, message);
    }
}
