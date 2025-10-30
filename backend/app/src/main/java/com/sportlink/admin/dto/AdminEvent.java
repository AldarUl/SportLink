package com.sportlink.admin.dto;

import com.sportlink.event.model.EventKind;
import com.sportlink.event.model.EventStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminEvent(
        UUID id,
        EventKind kind,
        String title,
        String sport,
        OffsetDateTime startsAt,
        Integer capacity,
        EventStatus status,
        UUID organizerId
) {}
