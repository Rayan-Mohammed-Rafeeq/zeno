package com.zeno.modules.intelligence.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ai_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAssessmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(name = "subject_type", length = 20)
    private String subjectType;

    @Column(name = "subject_id")
    private UUID subjectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "assessment_type")
    private AssessmentType assessmentType;

    @Column(name = "confidence")
    private Double confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reasons", columnDefinition = "jsonb")
    private List<String> reasons;

    @Column(name = "recommended_action", length = 30)
    private String recommendedAction;

    @Column(name = "provider", length = 30)
    private String provider;

    /** Raw prompt used — stored for auditability, never exposes secrets */
    @Column(name = "prompt_summary", length = 500)
    private String promptSummary;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
