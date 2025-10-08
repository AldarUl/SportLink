package com.sportlink.auth.dto;

import java.util.UUID;

public record LoginResponse(
        String token,          // заглушка; позже заменишь на JWT
        UUID userId,
        String email,
        String displayName
) {}
