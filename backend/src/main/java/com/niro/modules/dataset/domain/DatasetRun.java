package com.niro.modules.dataset.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dataset_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DatasetRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "record_count", nullable = false)
    private int recordCount;

    @Column(name = "seed", nullable = false)
    private long seed;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DatasetStatus status = DatasetStatus.GENERATING;

    @Column(name = "generated_at")
    private Instant generatedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
