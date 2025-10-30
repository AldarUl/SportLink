package com.sportlink.admin.dto;

import java.time.Instant;
import java.util.UUID;

public record AdminUser(UUID id, String email, String displayName, Instant createdAt) {}
