package com.zeno.api.patient;

import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.common.security.ZenoPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientRepository patientRepository;

    @GetMapping
    public ResponseEntity<List<Patient>> getAll(@AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        if (orgId != null) {
            return ResponseEntity.ok(patientRepository.findByOrganizationId(orgId));
        }
        return ResponseEntity.ok(patientRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Patient> getById(@PathVariable Long id) {
        return ResponseEntity.ok(patientRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Patient", id)));
    }

    @PostMapping
    public ResponseEntity<Patient> create(@RequestBody Patient patient) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientRepository.save(patient));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Patient> update(@PathVariable Long id, @RequestBody Patient updated) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Patient", id));
        if (updated.getFirstName() != null) patient.setFirstName(updated.getFirstName());
        if (updated.getLastName() != null) patient.setLastName(updated.getLastName());
        if (updated.getEmail() != null) patient.setEmail(updated.getEmail());
        if (updated.getPhoneNumber() != null) patient.setPhoneNumber(updated.getPhoneNumber());
        return ResponseEntity.ok(patientRepository.save(patient));
    }
}
