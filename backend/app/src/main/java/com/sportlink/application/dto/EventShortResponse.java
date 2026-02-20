package com.sportlink.application.dto;

import com.sportlink.event.model.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Короткая модель события для панели "Мои ближайшие тренировки".
 * Содержит ровно то, что нужно фронту в списках.
 */
public record EventShortResponse(
        UUID id,
        EventKind kind,
        String title,
        String sport,
        OffsetDateTime startsAt,
        Integer durationMin,
        EventStatus status,
        OffsetDateTime launchedAt,
        EventAccess access,
        EventAdmission admission,
        Integer capacity,
        Double locationLat,
        Double locationLon
) {}
