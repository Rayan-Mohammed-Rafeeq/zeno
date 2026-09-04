package com.zeno.modules.graph.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RiskClusterRepository {
    Optional<RiskCluster> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<RiskCluster> findByMerchantId(UUID merchantId, Pageable pageable);
    List<RiskCluster> findAllByMerchantId(UUID merchantId);
    long countByMerchantId(UUID merchantId);
}
