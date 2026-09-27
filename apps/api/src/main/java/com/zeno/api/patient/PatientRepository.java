package com.zeno.api.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
    List<Patient> findByOrganizationId(Long organizationId);
    Optional<Patient> findByMrn(String mrn);
    Optional<Patient> findByEmail(String email);
    List<Patient> findByOrganizationIdAndLastNameContainingIgnoreCase(Long orgId, String lastName);
}
