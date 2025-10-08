package com.sportlink.application.dto;

import com.sportlink.application.model.ApplicationStatus;
import java.util.UUID;

public record ApplicationResponse(UUID id, UUID eventId, UUID userId, ApplicationStatus status) {}
