package com.zeno.modules.merchant.domain;

import java.util.Optional;
import java.util.UUID;

public interface MerchantRepository {
    Merchant save(Merchant merchant);
    Optional<Merchant> findById(UUID id);
    Optional<Merchant> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
