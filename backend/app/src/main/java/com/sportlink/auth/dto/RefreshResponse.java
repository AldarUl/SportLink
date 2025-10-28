package com.sportlink.auth.dto;

public record RefreshResponse(
        String accessToken,
        long   expiresIn
) {}
