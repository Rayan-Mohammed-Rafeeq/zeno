package com.zeno.api.organization;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByName(String name);
    List<Organization> findByType(Organization.OrganizationType type);
    List<Organization> findByStatus(Organization.OrganizationStatus status);
}
