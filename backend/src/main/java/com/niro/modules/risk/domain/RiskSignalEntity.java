package com.niro.modules.risk.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "risk_signals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskSignalEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "assessment_id", nullable = false)
    private UUID assessmentId;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "signal_type", nullable = false)
    private SignalType signalType;

    @Column(name = "observed_value")
    private Double observedValue;

    @Column(name = "baseline_value")
    private Double baselineValue;

    @Column(name = "score_contribution", nullable = false)
    private int scoreContribution;

    @Column(name = "severity", nullable = false)
    @Enumerated(EnumType.STRING)
    private RiskLevel severity;

    @Column(name = "explanation", length = 500)
    private String explanation;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
