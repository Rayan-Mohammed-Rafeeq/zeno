package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class ExternalServiceException extends ZenoException {

    public ExternalServiceException(String service, String message) {
        super(HttpStatus.BAD_GATEWAY, "EXTERNAL_SERVICE_ERROR",
                String.format("[%s] %s", service, message));
    }

    public ExternalServiceException(String service, String message, Throwable cause) {
        super(HttpStatus.BAD_GATEWAY, "EXTERNAL_SERVICE_ERROR",
                String.format("[%s] %s", service, message), cause);
    }
}
