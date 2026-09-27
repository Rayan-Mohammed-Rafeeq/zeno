package com.zeno.api.refill;

import com.zeno.api.common.exception.BusinessException;
import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.patient.Patient;
import com.zeno.api.patient.PatientRepository;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.pharmacy.PharmacyRepository;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.prescription.PrescriptionRepository;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Core service for creating and managing refill requests.
 * Handles the initial lifecycle of a refill from submission through triage.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RefillRequestService {

    private static final Logger log = LoggerFactory.getLogger(RefillRequestService.class);

    private final RefillRequestRepository refillRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final PharmacyRepository pharmacyRepository;
    private final UserRepository userRepository;
    private final RefillEventRepository eventRepository;

    @Transactional(readOnly = true)
    public RefillRequest findById(Long id) {
        return refillRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("RefillRequest", id));
    }

    @Transactional(readOnly = true)
    public List<RefillRequest> findAll() {
        return refillRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<RefillRequest> findActiveByOrganizationId(Long orgId) {
        return refillRepository.findActiveByOrganizationId(orgId);
    }

    public RefillRequest createRefillRequest(CreateRefillRequestCommand cmd) {
        log.info("Creating refill request for prescription={}, pharmacy={}", cmd.prescriptionId(), cmd.pharmacyId());

        Prescription prescription = prescriptionRepository.findById(cmd.prescriptionId())
                .orElseThrow(() -> ResourceNotFoundException.of("Prescription", cmd.prescriptionId()));

        Patient patient = prescription.getPatient();

        Pharmacy pharmacy = pharmacyRepository.findById(cmd.pharmacyId())
                .orElseThrow(() -> ResourceNotFoundException.of("Pharmacy", cmd.pharmacyId()));

        User requestedBy = null;
        if (cmd.requestedByUserId() != null) {
            requestedBy = userRepository.findById(cmd.requestedByUserId())
                    .orElseThrow(() -> ResourceNotFoundException.of("User", cmd.requestedByUserId()));
        }

        RefillRequest request = RefillRequest.builder()
                .prescription(prescription)
                .patient(patient)
                .pharmacy(pharmacy)
                .requestedBy(requestedBy)
                .status(RefillStatus.REQUESTED)
                .priority(cmd.priority() != null ? cmd.priority() : RefillPriority.NORMAL)
                .notes(cmd.notes())
                .build();

        RefillRequest saved = refillRepository.save(request);

        // Record the creation event
        recordEvent(saved, RefillEventType.REFILL_REQUESTED, null,
                RefillStatus.REQUESTED,
                "Refill request submitted for " + prescription.getMedicationName(),
                requestedBy, "refill-request-service");

        log.info("Created refill request id={}, status=REQUESTED, prescriptionId={}",
                saved.getId(), prescription.getId());

        return saved;
    }

    public RefillRequest cancel(Long refillId, String reason, User actor) {
        RefillRequest request = findById(refillId);

        if (request.getStatus() == RefillStatus.COMPLETED ||
            request.getStatus() == RefillStatus.CANCELLED) {
            throw new BusinessException("Cannot cancel a refill request in status: " + request.getStatus());
        }

        RefillStatus prev = request.getStatus();
        request.setStatus(RefillStatus.CANCELLED);
        RefillRequest saved = refillRepository.save(request);

        recordEvent(saved, RefillEventType.REFILL_CANCELLED, prev, RefillStatus.CANCELLED,
                "Refill request cancelled: " + reason, actor, null);

        return saved;
    }

    public void recordEvent(RefillRequest request, RefillEventType type,
                            RefillStatus from, RefillStatus to,
                            String description, User actor, String actorLabel) {
        RefillEvent event = RefillEvent.builder()
                .refillRequest(request)
                .eventType(type)
                .fromStatus(from)
                .toStatus(to)
                .description(description)
                .actor(actor)
                .actorLabel(actorLabel != null ? actorLabel : (actor != null ? actor.getUsername() : "system"))
                .build();
        eventRepository.save(event);
    }

    /** Records event without status transition */
    public void recordEvent(RefillRequest request, RefillEventType type, String description, User actor) {
        recordEvent(request, type, null, null, description, actor, null);
    }
}
