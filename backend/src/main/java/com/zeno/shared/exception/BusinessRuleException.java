package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class BusinessRuleException extends ZenoException {

    public BusinessRuleException(String code, String message) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }
}
