package com.niro.modules.investigation.interfaces.dto;

import com.niro.modules.investigation.domain.Investigation;
import com.niro.modules.investigation.domain.InvestigationNote;
import com.niro.modules.investigation.domain.InvestigationStatus;
import com.niro.modules.investigation.domain.SubjectType;
import com.niro.modules.risk.domain.RiskLevel;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record InvestigationResponse(
        UUID id,
        UUID merchantId,
        SubjectType subjectType,
        UUID subjectId,
        RiskLevel riskLevel,
        InvestigationStatus status,
        UUID assignedTo,
        List<NoteResponse> notes,
        Instant createdAt,
        Instant updatedAt
) {
    public record NoteResponse(UUID id, UUID authorId, String content, Instant createdAt) {
        public static NoteResponse from(InvestigationNote n) {
            return new NoteResponse(n.getId(), n.getAuthorId(), n.getContent(), n.getCreatedAt());
        }
    }

    public static InvestigationResponse from(Investigation inv, List<InvestigationNote> notes) {
        return new InvestigationResponse(
                inv.getId(), inv.getMerchantId(), inv.getSubjectType(), inv.getSubjectId(),
                inv.getRiskLevel(), inv.getStatus(), inv.getAssignedTo(),
                notes.stream().map(NoteResponse::from).toList(),
                inv.getCreatedAt(), inv.getUpdatedAt());
    }

    public static InvestigationResponse from(Investigation inv) {
        return from(inv, List.of());
    }
}
