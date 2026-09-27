package com.zeno.api.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PharmacyRepository extends JpaRepository<Pharmacy, Long> {
    List<Pharmacy> findByOrganizationId(Long organizationId);
    Optional<Pharmacy> findByNcpdpId(String ncpdpId);
    List<Pharmacy> findByOrganizationIdAndStatus(Long orgId, Pharmacy.PharmacyStatus status);
}
