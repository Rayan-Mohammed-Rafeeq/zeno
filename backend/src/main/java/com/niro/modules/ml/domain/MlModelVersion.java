package com.niro.modules.ml.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "ml_model_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MlModelVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "model_version", nullable = false, length = 100)
    private String modelVersion;

    @Column(name = "algorithm", nullable = false, length = 50)
    private String algorithm;

    @Column(name = "feature_version", nullable = false, length = 20)
    private String featureVersion;

    @Column(name = "dataset_version", length = 100)
    private String datasetVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hyperparameters", columnDefinition = "jsonb")
    private Map<String, Object> hyperparameters;

    @Column(name = "val_precision")
    private Double valPrecision;

    @Column(name = "val_recall")
    private Double valRecall;

    @Column(name = "val_f1")
    private Double valF1;

    @Column(name = "val_auprc")
    private Double valAuprc;

    @Column(name = "val_roc_auc")
    private Double valRocAuc;

    @Column(name = "val_fpr")
    private Double valFpr;

    @Column(name = "val_expected_loss")
    private Double valExpectedLoss;

    @Column(name = "threshold", nullable = false)
    private double threshold;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
