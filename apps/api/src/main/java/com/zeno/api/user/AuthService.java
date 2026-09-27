package com.zeno.api.user;

import com.zeno.api.common.email.EmailService;
import com.zeno.api.common.exception.BusinessException;
import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.common.security.JwtUtil;
import com.zeno.api.organization.Organization;
import com.zeno.api.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;

    @Value("${resend.password-reset-expiry-minutes:30}")
    private int passwordResetExpiryMinutes;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new BusinessException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException("Invalid username or password");
        }

        if (!user.isActive()) {
            throw new BusinessException("Account is disabled. Contact your administrator.");
        }

        Long orgId = user.getOrganization() != null ? user.getOrganization().getId() : null;
        String token = jwtUtil.generateToken(user.getUsername(), user.getRoleString(), orgId);

        log.info("User logged in: username={}, role={}, orgId={}", user.getUsername(), user.getRoleString(), orgId);

        String roleDisplayName = user.getRole() != null ? user.getRole().getDisplayName() : user.getRoleString();
        return new AuthResponse(token, user.getRoleString(), roleDisplayName, orgId, user.getUsername(),
                user.getFirstName(), user.getLastName());
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse currentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException("Authenticated user no longer exists"));
        Long orgId = user.getOrganization() != null ? user.getOrganization().getId() : null;
        String displayName = user.getRole() != null
                ? user.getRole().getDisplayName() : user.getRoleString();
        String fullName = (user.getFirstName() == null ? "" : user.getFirstName())
                + (user.getLastName() == null ? "" : " " + user.getLastName());
        return new CurrentUserResponse(
                user.getId(), user.getUsername(), user.getEmail(), fullName.trim(),
                user.getRoleString(), displayName, orgId, user.isActive(), user.getCreatedAt()
        );
    }

    public AuthResponse register(RegisterRequest request) {
        if (request.username() == null || request.username().isBlank()
                || request.password() == null || request.email() == null
                || request.role() == null || request.firstName() == null) {
            throw new BusinessException("Username, email, password, name, and role are required.");
        }
        if (userRepository.existsByUsername(request.username())) {
            throw new BusinessException("Username already exists: " + request.username());
        }

        UserRole role;
        try {
            role = UserRole.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid role: " + request.role());
        }
        if (role == UserRole.ADMIN) {
            throw new BusinessException("Administrator accounts can only be created by an administrator.");
        }

        Organization organization;
        if (request.organizationId() != null) {
            organization = organizationRepository.findById(request.organizationId())
                    .orElseThrow(() -> ResourceNotFoundException.of("Organization", request.organizationId()));
        } else {
            if (request.organizationName() == null || request.organizationName().isBlank()) {
                throw new BusinessException("Organization name is required.");
            }
            Organization.OrganizationType type = role == UserRole.PHARMACIST || role == UserRole.PHARMACY_STAFF
                    ? Organization.OrganizationType.PHARMACY
                    : Organization.OrganizationType.PRACTICE;
            organization = organizationRepository.save(Organization.builder()
                    .name(request.organizationName().trim())
                    .type(type)
                    .email(request.email().trim())
                    .build());
        }

        User user = User.builder()
                .username(request.username())
                .password(passwordEncoder.encode(request.password()))
                .role(role)
                .firstName(request.firstName())
                .lastName(request.lastName())
                .email(request.email())
                .organization(organization)
                .active(true)
                .build();

        userRepository.save(user);
        log.info("User registered: username={}, role={}, orgId={}", user.getUsername(), role, request.organizationId());

        Long orgId = organization != null ? organization.getId() : null;
        String token = jwtUtil.generateToken(user.getUsername(), user.getRoleString(), orgId);
        String roleDisplayName = user.getRole() != null ? user.getRole().getDisplayName() : user.getRoleString();
        return new AuthResponse(token, user.getRoleString(), roleDisplayName, orgId, user.getUsername(),
                user.getFirstName(), user.getLastName());
    }

    /**
     * Initiates the forgot-password flow.
     * Always returns successfully — even when the email is not found — to prevent
     * user enumeration attacks.
     */
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.email()).ifPresent(user -> {
            // Invalidate any previously issued tokens for this user
            passwordResetTokenRepository.invalidateAllForUser(user.getId());

            // Generate a 32-byte (64 hex chars) cryptographically secure token
            byte[] bytes = new byte[32];
            SECURE_RANDOM.nextBytes(bytes);
            String rawToken = HexFormat.of().formatHex(bytes);

            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token(rawToken)
                    .user(user)
                    .expiresAt(LocalDateTime.now().plusMinutes(passwordResetExpiryMinutes))
                    .build();

            passwordResetTokenRepository.save(resetToken);

            String resetLink = frontendUrl + "/reset-password?token=" + rawToken;
            emailService.sendPasswordResetEmail(user.getEmail(), resetLink);

            log.info("Password reset token issued for userId={}", user.getId());
        });
    }

    /**
     * Validates the reset token and updates the user's password.
     */
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByToken(request.token())
                .orElseThrow(() -> new BusinessException("Invalid or expired password reset token."));

        if (!resetToken.isValid()) {
            throw new BusinessException("Invalid or expired password reset token.");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // Mark token as used so it cannot be replayed
        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        log.info("Password reset successfully for userId={}", user.getId());
    }
}
