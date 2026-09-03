package com.niro.modules.customer.interfaces.dto;

import com.niro.modules.customer.domain.Customer;
import com.niro.modules.customer.domain.CustomerStatus;

import java.time.Instant;
import java.util.UUID;

public record CustomerResponse(
        UUID id,
        UUID merchantId,
        String externalCustomerId,
        Integer accountAgeDays,
        CustomerStatus status,
        String country,
        String region,
        String syntheticProfileType,
        Instant createdAt
) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(
                c.getId(), c.getMerchantId(), c.getExternalCustomerId(),
                c.getAccountAgeDays(), c.getStatus(), c.getCountry(),
                c.getRegion(), c.getSyntheticProfileType(), c.getCreatedAt());
    }
}
