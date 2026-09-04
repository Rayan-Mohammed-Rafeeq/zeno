package com.zeno.modules.graph.domain;

import com.zeno.modules.risk.domain.RiskLevel;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "risk_clusters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskCluster {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "risk_score", nullable = false)
    private int riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false)
    private RiskLevel riskLevel;

    @Column(name = "member_count", nullable = false)
    private int memberCount;

    @Column(name = "estimated_exposure", precision = 18, scale = 2)
    private BigDecimal estimatedExposure;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ClusterStatus status = ClusterStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
