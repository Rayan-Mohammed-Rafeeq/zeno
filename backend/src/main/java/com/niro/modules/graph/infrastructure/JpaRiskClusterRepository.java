package com.niro.modules.graph.infrastructure;

import com.niro.modules.graph.domain.RiskCluster;
import com.niro.modules.graph.domain.RiskClusterRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaRiskClusterRepository extends JpaRepository<RiskCluster, UUID>, RiskClusterRepository {
    Optional<RiskCluster> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<RiskCluster> findByMerchantId(UUID merchantId, Pageable pageable);
    List<RiskCluster> findAllByMerchantId(UUID merchantId);
    long countByMerchantId(UUID merchantId);

    @Modifying
    @Query("DELETE FROM RiskCluster c WHERE c.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}
