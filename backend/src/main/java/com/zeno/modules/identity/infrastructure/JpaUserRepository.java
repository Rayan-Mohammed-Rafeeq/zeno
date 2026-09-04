package com.zeno.modules.identity.infrastructure;

import com.zeno.modules.identity.domain.User;
import com.zeno.modules.identity.domain.UserRepository;
import com.zeno.modules.identity.domain.UserStatus;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaUserRepository extends JpaRepository<User, UUID>, UserRepository {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    // count() is already provided by JpaRepository — no override needed

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.status = :status WHERE u.id = :userId")
    void updateStatus(UUID userId, UserStatus status);
}
