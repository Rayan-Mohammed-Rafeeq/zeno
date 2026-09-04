package com.zeno.modules.graph.domain;

import java.util.List;
import java.util.UUID;

public interface ClusterMemberRepository {
    List<ClusterMember> findAllByClusterId(UUID clusterId);
}
