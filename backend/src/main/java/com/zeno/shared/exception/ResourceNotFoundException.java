package com.zeno.shared.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends ZenoException {

    public ResourceNotFoundException(String resource, Object id) {
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND",
                String.format("%s with id '%s' not found", resource, id));
    }

    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", message);
    }
}
