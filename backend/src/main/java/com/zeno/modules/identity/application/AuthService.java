package com.zeno.modules.identity.application;

import com.zeno.config.JwtService;
import com.zeno.config.ZenoProperties;
import com.zeno.modules.identity.domain.*;
import com.zeno.modules.identity.interfaces.dto.*;
import com.zeno.modules.merchant.application.MerchantService;
import com.zeno.modules.merchant.interfaces.dto.CreateMerchantRequest;
import com.zeno.shared.exception.BusinessRuleException;
import com.zeno.shared.exception.ConflictException;
import com.zeno.shared.exception.ResourceNotFoundException;
import com.zeno.shared.exception.UnauthorizedException;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
    private static final int RESET_TOKEN_EXPIRY_HOURS = 1;

    private final UserRepository userRepository;
    private final VerificationTokenRepository verificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final MerchantService merchantService;
    private final ZenoProperties properties;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email().toLowerCase())) {
            throw new ConflictException("EMAIL_ALREADY_EXISTS", "An account with this email already exists");
        }

        // Every registration creates a new merchant workspace; the registering user is its ADMIN
        User user = User.builder()
                .name(request.name().trim())
                .email(request.email().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(UserRole.ADMIN)
                .emailVerified(false)
                .status(UserStatus.PENDING_VERIFICATION)
                .build();
        user = userRepository.save(user);

        // Create the merchant and link the user — all within the same transaction
        merchantService.createMerchant(user.getId(), new CreateMerchantRequest(request.merchantName().trim()));

        String rawToken = generateSecureToken();
        issueVerificationToken(user.getId(), rawToken);
        emailService.sendVerificationEmail(user.getEmail(), user.getName(), rawToken);

        log.info("Merchant admin registered: userId={}", user.getId());
        return new RegisterResponse(user.getId(), user.getEmail(),
                "Registration successful. Please check your email to verify your account.");
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email().toLowerCase())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }

        if (!user.isEmailVerified()) {
            throw new BusinessRuleException("EMAIL_NOT_VERIFIED", "Please verify your email before logging in");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new BusinessRuleException("ACCOUNT_SUSPENDED", "This account has been suspended");
        }

        String token = jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole());
        log.info("User logged in: {}", user.getId());
        return new LoginResponse(token, user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        String hash = hashToken(request.token());
        VerificationToken vt = verificationTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BusinessRuleException("INVALID_TOKEN", "Verification token is invalid or has already been used"));

        if (!vt.isValid()) {
            throw new BusinessRuleException("TOKEN_EXPIRED", "Verification token has expired. Please request a new one.");
        }

        User user = userRepository.findById(vt.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", vt.getUserId()));

        user.setEmailVerified(true);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        vt.setConsumedAt(Instant.now());
        verificationTokenRepository.save(vt);

        log.info("Email verified for user: {}", user.getId());
    }

    @Transactional
    public void resendVerification(ResendVerificationRequest request) {
        User user = userRepository.findByEmail(request.email().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("No account found with that email address"));

        if (user.isEmailVerified()) {
            throw new BusinessRuleException("ALREADY_VERIFIED", "Email is already verified");
        }

        verificationTokenRepository.deleteByUserId(user.getId());
        String rawToken = generateSecureToken();
        issueVerificationToken(user.getId(), rawToken);
        emailService.sendVerificationEmail(user.getEmail(), user.getName(), rawToken);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        // Always return success to prevent email enumeration
        userRepository.findByEmail(request.email().toLowerCase()).ifPresent(user -> {
            passwordResetTokenRepository.deleteByUserId(user.getId());
            String rawToken = generateSecureToken();
            PasswordResetToken prt = PasswordResetToken.builder()
                    .userId(user.getId())
                    .tokenHash(hashToken(rawToken))
                    .expiresAt(Instant.now().plus(RESET_TOKEN_EXPIRY_HOURS, ChronoUnit.HOURS))
                    .build();
            passwordResetTokenRepository.save(prt);
            emailService.sendPasswordResetEmail(user.getEmail(), user.getName(), rawToken);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String hash = hashToken(request.token());
        PasswordResetToken prt = passwordResetTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BusinessRuleException("INVALID_TOKEN", "Password reset token is invalid or has already been used"));

        if (!prt.isValid()) {
            throw new BusinessRuleException("TOKEN_EXPIRED", "Password reset token has expired. Please request a new one.");
        }

        User user = userRepository.findById(prt.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", prt.getUserId()));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        prt.setConsumedAt(Instant.now());
        passwordResetTokenRepository.save(prt);

        log.info("Password reset for user: {}", user.getId());
    }

    public UserResponse getMe(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return UserResponse.from(user);
    }

    // ---- helpers ----

    private void issueVerificationToken(UUID userId, String rawToken) {
        VerificationToken vt = VerificationToken.builder()
                .userId(userId)
                .tokenHash(hashToken(rawToken))
                .expiresAt(Instant.now().plus(VERIFICATION_TOKEN_EXPIRY_HOURS, ChronoUnit.HOURS))
                .build();
        verificationTokenRepository.save(vt);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[32];
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
