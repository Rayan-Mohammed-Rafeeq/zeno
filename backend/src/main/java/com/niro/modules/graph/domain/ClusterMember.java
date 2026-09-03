package com.niro.modules.graph.domain;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "cluster_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"cluster_id", "entity_type", "entity_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClusterMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cluster_id", nullable = false)
    private UUID clusterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false)
    private NodeType entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;
}
