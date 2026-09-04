package com.zeno.modules.merchant.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantUserRepository {
    MerchantUser save(MerchantUser merchantUser);
    Optional<MerchantUser> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
    List<MerchantUser> findByMerchantId(UUID merchantId);
}
