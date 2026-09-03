package com.niro.modules.graph.infrastructure;

import com.niro.modules.graph.domain.ClusterMember;
import com.niro.modules.graph.domain.ClusterMemberRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JpaClusterMemberRepository extends JpaRepository<ClusterMember, UUID>, ClusterMemberRepository {
    List<ClusterMember> findAllByClusterId(UUID clusterId);

    @Modifying
    @Query("DELETE FROM ClusterMember m WHERE m.clusterId = :clusterId")
    void deleteAllByClusterId(UUID clusterId);

    @Modifying
    @Query("DELETE FROM ClusterMember m WHERE m.clusterId IN :clusterIds")
    void deleteAllByClusterIdIn(List<UUID> clusterIds);
}
