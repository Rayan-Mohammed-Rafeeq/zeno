package com.zeno.api.refill;

import java.time.LocalDateTime;

/** Safe timeline representation that never serializes JPA entities or user credentials. */
public record RefillEventResponse(
        Long id,
        Long refillRequestId,
        RefillEventType eventType,
        String description,
        RefillStatus fromStatus,
        RefillStatus toStatus,
        String actorLabel,
        Long relatedCaseId,
        Long relatedActionId,
        LocalDateTime createdAt
) {
    static RefillEventResponse from(RefillEvent event) {
        String label = event.getActorLabel();
        if ((label == null || label.isBlank()) && event.getActor() != null) {
            label = (event.getActor().getFirstName() + " " + event.getActor().getLastName()).trim();
        }
        if (label == null || label.isBlank()) label = "System";

        return new RefillEventResponse(
                event.getId(), event.getRefillRequest().getId(), event.getEventType(),
                event.getDescription(), event.getFromStatus(), event.getToStatus(), label,
                event.getRelatedCaseId(), event.getRelatedActionId(), event.getCreatedAt()
        );
    }
}
