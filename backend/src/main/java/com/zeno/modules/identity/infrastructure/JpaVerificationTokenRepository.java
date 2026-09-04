package com.zeno.modules.identity.infrastructure;

import com.zeno.modules.identity.domain.VerificationToken;
import com.zeno.modules.identity.domain.VerificationTokenRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaVerificationTokenRepository extends JpaRepository<VerificationToken, UUID>, VerificationTokenRepository {
    Optional<VerificationToken> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
}
