package com.niro.modules.merchant.infrastructure;

import com.niro.modules.merchant.domain.Merchant;
import com.niro.modules.merchant.domain.MerchantRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaMerchantRepository extends JpaRepository<Merchant, UUID>, MerchantRepository {
    Optional<Merchant> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
