package com.sportlink.event.dto;

import com.sportlink.event.model.*;
import java.time.OffsetDateTime;
import java.util.UUID;

public record EventResponse(
        UUID id,
        EventKind kind,
        String title,
        String sport,
        String description,
        OffsetDateTime startsAt,
        Integer durationMin,
        Integer capacity,
        boolean waitlistEnabled,
        EventAccess access,
        EventAdmission admission,
        String recurrenceRule,
        OffsetDateTime registrationDeadline,
        UUID organizerId,
        UUID clubId,
        Double locationLat,
        Double locationLon,
        EventStatus status
) {}
