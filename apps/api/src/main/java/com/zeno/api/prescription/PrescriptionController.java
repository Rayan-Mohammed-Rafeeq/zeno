package com.zeno.api.prescription;

import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.common.security.ZenoPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/prescriptions")
@RequiredArgsConstructor
public class PrescriptionController {

    private final PrescriptionRepository prescriptionRepository;

    @GetMapping
    public ResponseEntity<List<PrescriptionResponse>> getAll(@AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        List<Prescription> prescriptions;
        if (orgId != null) {
            prescriptions = prescriptionRepository.findByOrganizationIdWithDetails(orgId);
        } else {
            prescriptions = prescriptionRepository.findAllWithDetails();
        }
        return ResponseEntity.ok(prescriptions.stream().map(PrescriptionResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PrescriptionResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(PrescriptionResponse.from(prescriptionRepository.findWithDetailsById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Prescription", id))));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<PrescriptionResponse>> getByPatient(@PathVariable Long patientId) {
        return ResponseEntity.ok(prescriptionRepository.findWithDetailsByPatientId(patientId).stream()
                .map(PrescriptionResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<Prescription> create(@RequestBody Prescription prescription) {
        return ResponseEntity.status(HttpStatus.CREATED).body(prescriptionRepository.save(prescription));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Prescription> update(@PathVariable Long id, @RequestBody Prescription updated) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Prescription", id));
        if (updated.getStatus() != null) prescription.setStatus(updated.getStatus());
        if (updated.getInstructions() != null) prescription.setInstructions(updated.getInstructions());
        if (updated.getRefillsAllowed() != null) prescription.setRefillsAllowed(updated.getRefillsAllowed());
        return ResponseEntity.ok(prescriptionRepository.save(prescription));
    }
}
