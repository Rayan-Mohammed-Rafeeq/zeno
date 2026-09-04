package com.zeno.modules.identity.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.identity.application.AuthService;
import com.zeno.modules.identity.interfaces.dto.*;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "User registration, login, and account management")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user account")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout (client-side token invalidation)")
    public ResponseEntity<ApiResponse<Map<String, String>>> logout() {
        // JWT is stateless — client discards the token
        return ResponseEntity.ok(ApiResponse.of(Map.of("message", "Logged out successfully")));
    }

    @GetMapping("/me")
    @Operation(summary = "Get the current authenticated user")
    public ResponseEntity<ApiResponse<UserResponse>> me() {
        UserResponse response = authService.getMe(SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.of(response));
    }

    @PostMapping("/verify-email")
    @Operation(summary = "Verify email address with a token")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);
        return ResponseEntity.ok(ApiResponse.of(Map.of("message", "Email verified successfully")));
    }

    @PostMapping("/resend-verification")
    @Operation(summary = "Resend email verification link")
    public ResponseEntity<ApiResponse<Map<String, String>>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request) {
        authService.resendVerification(request);
        return ResponseEntity.ok(ApiResponse.of(Map.of("message", "Verification email sent")));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a password reset email")
    public ResponseEntity<ApiResponse<Map<String, String>>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        // Always return success to prevent email enumeration
        return ResponseEntity.ok(ApiResponse.of(Map.of(
                "message", "If an account exists with that email, a password reset link has been sent")));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with a valid reset token")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.of(Map.of("message", "Password reset successfully")));
    }
}
