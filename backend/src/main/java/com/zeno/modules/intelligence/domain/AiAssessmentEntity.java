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

    /** Legacy flat reasons list — kept for backwards compat */
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

    /**
     * Full structured assessment result stored as JSONB.
     * Populated when the LLM returns parseable structured output.
     * Null if AI failed — deterministic assessment still available via other fields.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "structured_result", columnDefinition = "jsonb")
    private StructuredResult structuredResult;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    // ── Embedded structured result ────────────────────────────────────────

    /**
     * SHAP-grounded structured assessment as returned by the LLM.
     * Matches the JSON schema required in the prompt.
     */
    @lombok.Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StructuredResult {

        private String assessment;          // HIGH_RISK | MEDIUM_RISK | LOW_RISK | INCONCLUSIVE
        private Integer confidence;         // 0-100
        private String recommendedAction;
        private String summary;
        private List<ReasonEntry> reasons;
        private MlEvidence mlEvidence;
        private NetworkEvidence networkEvidence;
        private List<String> limitations;
        private String analystNote;
        /** true = full LLM structured output; false = deterministic fallback */
        private boolean aiGenerated;

        @lombok.Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ReasonEntry {
            private String signal;
            private String observed;
            private String baseline;
            private String interpretation;
        }

        @lombok.Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class MlEvidence {
            private Double fraudProbability;
            private List<String> topShapDrivers;
            private String modelVersion;
            private String disclaimer;
        }

        @lombok.Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class NetworkEvidence {
            private Boolean clusterDetected;
            private Integer clusterSize;
            private String relationshipSummary;
        }
    }
}
