package com.zeno.api.common.config;

import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import com.zeno.api.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Bootstraps the initial ADMIN user if one doesn't already exist.
 * This is a safety net — seed data also creates the admin user.
 */
@Configuration
@RequiredArgsConstructor
public class AdminBootstrapConfig {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapConfig.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.username:admin}")
    private String adminUsername;

    @Value("${admin.password:changeme}")
    private String adminPassword;

    @Bean
    public CommandLineRunner bootstrapAdmin() {
        return args -> {
            if (userRepository.findByRole(UserRole.ADMIN).isPresent()) {
                log.info("Admin user already exists — skipping bootstrap");
                return;
            }

            if (adminUsername.isBlank() || adminPassword.isBlank()) {
                log.warn("ADMIN_USERNAME or ADMIN_PASSWORD is not set — admin user not created");
                return;
            }

            User admin = User.builder()
                    .username(adminUsername)
                    .password(passwordEncoder.encode(adminPassword))
                    .role(UserRole.ADMIN)
                    .firstName("System")
                    .lastName("Admin")
                    .active(true)
                    .build();

            userRepository.save(admin);
            log.info("Bootstrap admin user created: {}", adminUsername);
        };
    }
}
