package com.niro.modules.dataset.domain;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "ground_truth_labels",
        indexes = {
            @Index(name = "idx_gtl_dataset_run", columnList = "dataset_run_id"),
            @Index(name = "idx_gtl_entity", columnList = "entity_type, entity_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroundTruthLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "dataset_run_id", nullable = false)
    private UUID datasetRunId;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "entity_type", nullable = false, length = 20)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    /**
     * True = this entity is part of the abuse scenario (positive label).
     * Ground truth is NOT exposed to the detector — evaluation only.
     */
    @Column(nullable = false)
    private boolean positive;

    @Column(name = "abuse_cluster_id")
    private String abuseClusterId;

    @Column(name = "scenario_type", length = 50)
    private String scenarioType;
}
