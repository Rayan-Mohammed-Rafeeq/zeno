package com.niro.modules.identity.infrastructure;

import com.niro.modules.identity.domain.PasswordResetToken;
import com.niro.modules.identity.domain.PasswordResetTokenRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaPasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID>, PasswordResetTokenRepository {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
}
