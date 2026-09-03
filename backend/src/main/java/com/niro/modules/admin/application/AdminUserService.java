package com.niro.modules.admin.application;

import com.niro.modules.admin.interfaces.dto.AdminCreateUserRequest;
import com.niro.modules.admin.interfaces.dto.AdminUserResponse;
import com.niro.modules.identity.application.EmailService;
import com.niro.modules.identity.domain.*;
import com.niro.modules.merchant.application.MerchantService;
import com.niro.modules.merchant.domain.MerchantUser;
import com.niro.modules.merchant.domain.MerchantUserRepository;
import com.niro.shared.exception.BusinessRuleException;
import com.niro.shared.exception.ConflictException;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final VerificationTokenRepository verificationTokenRepository;
    private final MerchantService merchantService;
    private final MerchantUserRepository merchantUserRepository;

    /**
     * Lists all users belonging to the same merchant as the calling admin.
     */
    public List<AdminUserResponse> listUsers(UUID callerUserId) {
        UUID merchantId = merchantService.resolveMerchantId(callerUserId);
        List<UUID> memberIds = merchantUserRepository.findByMerchantId(merchantId)
                .stream()
                .map(MerchantUser::getUserId)
                .toList();

        return memberIds.stream()
                .map(uid -> userRepository.findById(uid)
                        .map(AdminUserResponse::from)
                        .orElse(null))
                .filter(u -> u != null)
                .toList();
    }

    /**
     * Creates a new user and links them to the calling admin's merchant.
     */
    @Transactional
    public AdminUserResponse createUser(UUID callerUserId, AdminCreateUserRequest request) {
        if (userRepository.existsByEmail(request.email().toLowerCase())) {
            throw new ConflictException("EMAIL_ALREADY_EXISTS", "An account with this email already exists");
        }

        // Resolve the admin's merchant — new user will belong to the same tenant
        UUID merchantId = merchantService.resolveMerchantId(callerUserId);

        // Generate a random temporary password — user must set their own via forgot-password
        String tempPassword = generateTempPassword();

        User user = User.builder()
                .name(request.name().trim())
                .email(request.email().toLowerCase())
                .passwordHash(passwordEncoder.encode(tempPassword))
                .role(request.role())
                .emailVerified(false)
                .status(UserStatus.PENDING_VERIFICATION)
                .build();
        user = userRepository.save(user);

        // Link the new user to the admin's merchant
        merchantUserRepository.save(MerchantUser.builder()
                .merchantId(merchantId)
                .userId(user.getId())
                .build());

        // Send verification email so the user can activate their account
        String rawToken = generateSecureToken();
        issueVerificationToken(user.getId(), rawToken);
        emailService.sendVerificationEmail(user.getEmail(), user.getName(), rawToken);

        log.info("Admin {} created user {} (role={}) for merchant {}",
                callerUserId, user.getId(), user.getRole(), merchantId);
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse setUserStatus(UUID callerUserId, UUID targetUserId, String action) {
        // Ensure the target user belongs to the same merchant as the caller
        UUID callerMerchant = merchantService.resolveMerchantId(callerUserId);
        UUID targetMerchant = merchantService.resolveMerchantId(targetUserId);
        if (!callerMerchant.equals(targetMerchant)) {
            throw new BusinessRuleException("CROSS_TENANT_ACTION",
                    "You can only manage users within your own organisation");
        }

        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", targetUserId));

        UserStatus newStatus = switch (action.toUpperCase()) {
            case "SUSPEND"  -> UserStatus.SUSPENDED;
            case "ACTIVATE" -> UserStatus.ACTIVE;
            default -> throw new BusinessRuleException("INVALID_ACTION",
                    "Supported actions: SUSPEND, ACTIVATE");
        };

        user.setStatus(newStatus);
        user = userRepository.save(user);
        log.info("Admin {} set user {} status to {}", callerUserId, targetUserId, newStatus);
        return AdminUserResponse.from(user);
    }

    // ---- helpers ----

    private void issueVerificationToken(UUID userId, String rawToken) {
        VerificationToken vt = VerificationToken.builder()
                .userId(userId)
                .tokenHash(hashToken(rawToken))
                .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                .build();
        verificationTokenRepository.save(vt);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String generateTempPassword() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
