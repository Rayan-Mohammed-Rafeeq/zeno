package com.zeno.api.pharmacy;

import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.common.security.ZenoPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pharmacies")
@RequiredArgsConstructor
public class PharmacyController {

    private final PharmacyRepository pharmacyRepository;

    @GetMapping
    public ResponseEntity<List<Pharmacy>> getAll(@AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        if (orgId != null) {
            return ResponseEntity.ok(pharmacyRepository.findByOrganizationId(orgId));
        }
        return ResponseEntity.ok(pharmacyRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Pharmacy> getById(@PathVariable Long id) {
        return ResponseEntity.ok(pharmacyRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Pharmacy", id)));
    }

    @PostMapping
    public ResponseEntity<Pharmacy> create(@RequestBody Pharmacy pharmacy) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pharmacyRepository.save(pharmacy));
    }
}
