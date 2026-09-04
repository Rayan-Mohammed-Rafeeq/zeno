package com.zeno.modules.evaluation.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "evaluation_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "dataset_run_id")
    private UUID datasetRunId;

    @Column(name = "evaluated_at")
    private Instant evaluatedAt;

    @Column(name = "sample_count", nullable = false)
    private int sampleCount;

    @Column(name = "true_positive",  nullable = false)
    private int truePositive;

    @Column(name = "true_negative",  nullable = false)
    private int trueNegative;

    @Column(name = "false_positive", nullable = false)
    private int falsePositive;

    @Column(name = "false_negative", nullable = false)
    private int falseNegative;

    @Column(name = "precision_score")
    private Double precisionScore;

    @Column(name = "recall_score")
    private Double recallScore;

    @Column(name = "f1_score")
    private Double f1Score;

    @Column(name = "false_positive_rate")
    private Double falsePositiveRate;

    @Column(name = "false_negative_rate")
    private Double falseNegativeRate;

    /**
     * Estimated cost of false positives.
     * NOTE: Based on configurable prototype assumptions — not real merchant loss.
     * See ZenoProperties.Evaluation.FalsePositiveCost for the assumed values.
     */
    @Column(name = "false_positive_cost")
    private Double falsePositiveCost;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
