package com.zeno.api.ai;

import com.zeno.api.patient.Patient;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.provider.Provider;
import com.zeno.api.refill.RefillEvent;
import com.zeno.api.refill.RefillEventRepository;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.resolution.ResolutionAction;
import com.zeno.api.resolution.ResolutionCase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Assembles AiRecommendationRequest from domain entities.
 *
 * Centralises PHI minimisation: only fields required for administrative
 * workflow reasoning are included. Full patient demographics are excluded.
 */
@Component
@RequiredArgsConstructor
public class AiRequestContextBuilder {

    private static final DateTimeFormatter DT_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final int MAX_TIMELINE_EVENTS = 15;

    private final RefillEventRepository eventRepository;

    public AiRecommendationRequest build(
            ResolutionCase resolutionCase,
            RefillRequest refillRequest,
            List<ResolutionAction> existingActions,
            String currentUserRole
    ) {
        Prescription rx = refillRequest.getPrescription();
        Patient patient = refillRequest.getPatient();
        Provider provider = rx.getProvider();

        // Timeline — last N events only, no PHI fields
        List<RefillEvent> events = eventRepository
                .findByRefillRequestIdOrderByCreatedAtAsc(refillRequest.getId());

        List<AiRecommendationRequest.TimelineEvent> timeline = events.stream()
                .skip(Math.max(0, events.size() - MAX_TIMELINE_EVENTS))
                .map(e -> AiRecommendationRequest.TimelineEvent.builder()
                        .eventType(e.getEventType().name())
                        .description(truncate(e.getDescription(), 300))
                        .actorLabel(e.getActorLabel())
                        .createdAt(e.getCreatedAt() != null ? e.getCreatedAt().format(DT_FORMAT) : null)
                        .build())
                .toList();

        // Existing actions
        List<AiRecommendationRequest.ExistingActionContext> actionContexts = existingActions.stream()
                .map(a -> AiRecommendationRequest.ExistingActionContext.builder()
                        .actionId(a.getId())
                        .actionType(a.getActionType().name())
                        .status(a.getStatus().name())
                        .assignedRole(a.getAssignedRole() != null ? a.getAssignedRole().name() : null)
                        .description(truncate(a.getDescription(), 300))
                        .createdAt(a.getCreatedAt() != null ? a.getCreatedAt().format(DT_FORMAT) : null)
                        .build())
                .toList();

        // Organization — derived from pharmacy (PHARMACY org) or patient org (PRACTICE)
        var orgRef = refillRequest.getPharmacy() != null && refillRequest.getPharmacy().getOrganization() != null
                ? refillRequest.getPharmacy().getOrganization()
                : (patient.getOrganization() != null ? patient.getOrganization() : null);

        AiRecommendationRequest.OrganizationContext orgContext = orgRef != null
                ? AiRecommendationRequest.OrganizationContext.builder()
                        .organizationId(orgRef.getId())
                        .organizationType(orgRef.getType().name())
                        .name(orgRef.getName())
                        .build()
                : AiRecommendationRequest.OrganizationContext.builder()
                        .organizationId(0L)
                        .organizationType("UNKNOWN")
                        .name("Unknown")
                        .build();

        return AiRecommendationRequest.builder()
                .refillId(refillRequest.getId())
                .caseId(resolutionCase.getId())
                .patient(AiRecommendationRequest.PatientContext.builder()
                        .patientId(patient.getId())
                        .mrn(patient.getMrn())
                        .dateOfBirth(patient.getDateOfBirth())
                        .organizationId(patient.getOrganization() != null ? patient.getOrganization().getId() : null)
                        .build())
                .prescription(AiRecommendationRequest.PrescriptionContext.builder()
                        .prescriptionId(rx.getId())
                        .medicationName(rx.getMedicationName())
                        .medicationStrength(rx.getMedicationStrength())
                        .refillsAllowed(rx.getRefillsAllowed())
                        .refillsUsed(rx.getRefillsUsed())
                        .refillsRemaining(rx.refillsRemaining())
                        .writtenDate(rx.getWrittenDate())
                        .expiryDate(rx.getExpiryDate())
                        .isExpired(rx.isExpired())
                        .isOutOfRefills(rx.isOutOfRefills())
                        .requiresPriorAuth(rx.isRequiresPriorAuth())
                        .deaSchedule(rx.getDeaSchedule())
                        .providerId(provider != null ? provider.getId() : null)
                        .providerName(provider != null ? provider.getFullName() : null)
                        .providerSpecialty(provider != null ? provider.getSpecialty() : null)
                        .build())
                .refillRequest(AiRecommendationRequest.RefillRequestContext.builder()
                        .refillId(refillRequest.getId())
                        .status(refillRequest.getStatus().name())
                        .blockerType(refillRequest.getBlockerType() != null
                                ? refillRequest.getBlockerType().name() : null)
                        .priority(refillRequest.getPriority().name())
                        .notes(truncate(refillRequest.getNotes(), 500))
                        .build())
                .resolutionCase(AiRecommendationRequest.ResolutionCaseContext.builder()
                        .caseId(resolutionCase.getId())
                        .status(resolutionCase.getStatus().name())
                        .reason(truncate(resolutionCase.getReason(), 500))
                        .priority(resolutionCase.getPriority().name())
                        .build())
                .existingActions(actionContexts)
                .timeline(timeline)
                .organization(orgContext)
                .currentUserRole(currentUserRole != null ? currentUserRole : "UNKNOWN")
                .build();
    }

    private static String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength) + "...";
    }
}
