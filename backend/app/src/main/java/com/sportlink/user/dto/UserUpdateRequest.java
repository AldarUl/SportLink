package com.sportlink.user.dto;

import jakarta.validation.constraints.Size;

public record UserUpdateRequest(
        @Size(max = 120) String displayName,
        // для смены пароля оба поля должны быть заполнены
        String currentPassword,
        @Size(min = 6, max = 128) String newPassword
) {}
