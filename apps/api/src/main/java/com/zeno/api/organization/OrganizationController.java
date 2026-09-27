package com.zeno.api.organization;

import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<Organization>> getAll() {
        return ResponseEntity.ok(organizationRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Organization> getById(@PathVariable Long id) {
        return ResponseEntity.ok(organizationRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Organization", id)));
    }

    @GetMapping("/{id}/users")
    public ResponseEntity<List<User>> getUsers(@PathVariable Long id) {
        return ResponseEntity.ok(userRepository.findByOrganizationId(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Organization> create(@RequestBody Organization org) {
        return ResponseEntity.status(HttpStatus.CREATED).body(organizationRepository.save(org));
    }
}
