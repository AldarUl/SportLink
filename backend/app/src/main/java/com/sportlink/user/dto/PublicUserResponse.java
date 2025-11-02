package com.sportlink.user.dto;

import java.util.UUID;

public record PublicUserResponse(
        UUID id,
        String displayName
        // сюда же позже avatarUrl/about/city
) {}
