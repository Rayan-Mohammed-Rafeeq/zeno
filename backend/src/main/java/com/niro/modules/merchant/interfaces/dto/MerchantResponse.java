package com.niro.modules.merchant.interfaces.dto;

import com.niro.modules.merchant.domain.Merchant;
import com.niro.modules.merchant.domain.MerchantStatus;

import java.time.Instant;
import java.util.UUID;

public record MerchantResponse(
        UUID id,
        String name,
        String slug,
        MerchantStatus status,
        Instant createdAt
) {
    public static MerchantResponse from(Merchant m) {
        return new MerchantResponse(m.getId(), m.getName(), m.getSlug(), m.getStatus(), m.getCreatedAt());
    }
}
