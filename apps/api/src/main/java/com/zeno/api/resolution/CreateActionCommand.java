package com.zeno.api.resolution;

import com.zeno.api.user.UserRole;

import java.time.LocalDateTime;

public record CreateActionCommand(
        ActionType actionType,
        UserRole assignedRole,
        Long assignedUserId,
        String description,
        LocalDateTime dueAt
) {}
