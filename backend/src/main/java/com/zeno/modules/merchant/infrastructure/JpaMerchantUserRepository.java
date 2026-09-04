package com.zeno.modules.merchant.infrastructure;

import com.zeno.modules.merchant.domain.MerchantUser;
import com.zeno.modules.merchant.domain.MerchantUserRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaMerchantUserRepository extends JpaRepository<MerchantUser, UUID>, MerchantUserRepository {
    Optional<MerchantUser> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
    List<MerchantUser> findByMerchantId(UUID merchantId);
}
