package com.niro.modules.identity.infrastructure;

import com.niro.modules.identity.domain.VerificationToken;
import com.niro.modules.identity.domain.VerificationTokenRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaVerificationTokenRepository extends JpaRepository<VerificationToken, UUID>, VerificationTokenRepository {
    Optional<VerificationToken> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
}
