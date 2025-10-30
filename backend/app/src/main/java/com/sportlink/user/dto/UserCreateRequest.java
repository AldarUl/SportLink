package com.sportlink.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserCreateRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(max = 120) String displayName,
        @NotBlank String password
) {}
