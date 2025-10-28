package com.sportlink.auth.dto;

import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonProperty;

public record LoginResponse(
        @JsonProperty("accessToken") String accessToken,
        long expiresIn,            // секунды жизни access
        UUID userId,
        String email,
        String displayName
) {}
