package com.zeno.api.provider;

import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.common.security.ZenoPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/providers")
@RequiredArgsConstructor
public class ProviderController {

    private final ProviderRepository providerRepository;

    @GetMapping
    public ResponseEntity<List<Provider>> getAll(@AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        if (orgId != null) {
            return ResponseEntity.ok(providerRepository.findByOrganizationId(orgId));
        }
        return ResponseEntity.ok(providerRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Provider> getById(@PathVariable Long id) {
        return ResponseEntity.ok(providerRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Provider", id)));
    }

    @PostMapping
    public ResponseEntity<Provider> create(@RequestBody Provider provider) {
        return ResponseEntity.status(HttpStatus.CREATED).body(providerRepository.save(provider));
    }
}
