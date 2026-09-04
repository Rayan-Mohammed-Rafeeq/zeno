package com.zeno.modules.admin.interfaces;

import com.zeno.config.SecurityUtils;
import com.zeno.modules.admin.application.AdminUserService;
import com.zeno.modules.admin.interfaces.dto.AdminCreateUserRequest;
import com.zeno.modules.admin.interfaces.dto.AdminUserResponse;
import com.zeno.shared.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin – Users", description = "User management (ADMIN only)")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(summary = "List users in the caller's merchant")
    public ResponseEntity<ApiResponse<List<AdminUserResponse>>> listUsers() {
        return ResponseEntity.ok(
                ApiResponse.of(adminUserService.listUsers(SecurityUtils.currentUserId())));
    }

    @PostMapping
    @Operation(summary = "Invite a new user into the caller's merchant")
    public ResponseEntity<ApiResponse<AdminUserResponse>> createUser(
            @Valid @RequestBody AdminCreateUserRequest request) {
        AdminUserResponse response = adminUserService.createUser(
                SecurityUtils.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(response));
    }

    @PatchMapping("/{userId}/status")
    @Operation(summary = "Suspend or reactivate a user within the caller's merchant")
    public ResponseEntity<ApiResponse<AdminUserResponse>> setStatus(
            @PathVariable UUID userId,
            @RequestParam String action) {
        return ResponseEntity.ok(ApiResponse.of(
                adminUserService.setUserStatus(SecurityUtils.currentUserId(), userId, action)));
    }
}
