package com.sportlink.application.dto;

import com.sportlink.application.model.ApplicationStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Ответ для эндпоинта /api/v1/application/mine (legacy-формат фронта):
 * заявка + короткая информация о событии.
 */
public record ApplicationWithEventResponse(
        UUID id,
        UUID eventId,
        UUID userId,
        ApplicationStatus status,
        Instant createdAt,
        EventShortResponse event
) {}
