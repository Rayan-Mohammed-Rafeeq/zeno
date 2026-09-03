package com.niro.modules.merchant.infrastructure;

import com.niro.modules.merchant.domain.MerchantUser;
import com.niro.modules.merchant.domain.MerchantUserRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaMerchantUserRepository extends JpaRepository<MerchantUser, UUID>, MerchantUserRepository {
    Optional<MerchantUser> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
