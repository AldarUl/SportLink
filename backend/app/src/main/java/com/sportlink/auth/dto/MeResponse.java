package com.sportlink.auth.dto;

import java.util.UUID;

public record MeResponse(UUID userId, String email, String displayName) {}
