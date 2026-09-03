package com.niro.modules.identity.infrastructure;

import com.niro.modules.identity.domain.User;
import com.niro.modules.identity.domain.UserRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaUserRepository extends JpaRepository<User, UUID>, UserRepository {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
