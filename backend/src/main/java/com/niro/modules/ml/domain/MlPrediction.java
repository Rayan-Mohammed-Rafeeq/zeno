package com.niro.modules.ml.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ml_predictions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MlPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "model_version_id")
    private UUID modelVersionId;

    @Column(name = "fraud_probability", nullable = false)
    private double fraudProbability;

    @Column(name = "anomaly_score", nullable = false)
    private double anomalyScore;

    @Column(name = "risk_score", nullable = false)
    private int riskScore;

    @Column(name = "risk_level", nullable = false, length = 10)
    private String riskLevel;

    @Column(name = "threshold", nullable = false)
    private double threshold;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "feature_contributions", columnDefinition = "jsonb")
    private List<FeatureContributionEntry> featureContributions;

    @Column(name = "processing_ms")
    private Integer processingMs;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /** Lightweight SHAP contribution record stored as JSON. */
    public record FeatureContributionEntry(
            String feature,
            double shapValue,
            String direction,
            int rank
    ) {}
}
