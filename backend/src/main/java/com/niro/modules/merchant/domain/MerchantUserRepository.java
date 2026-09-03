package com.niro.modules.merchant.domain;

import java.util.Optional;
import java.util.UUID;

public interface MerchantUserRepository {
    MerchantUser save(MerchantUser merchantUser);
    Optional<MerchantUser> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
