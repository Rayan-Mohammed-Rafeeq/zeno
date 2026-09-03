package com.niro.shared.exception;

import org.springframework.http.HttpStatus;

public class BusinessRuleException extends NiroException {

    public BusinessRuleException(String code, String message) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }
}
