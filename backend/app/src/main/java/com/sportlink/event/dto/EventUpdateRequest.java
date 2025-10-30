package com.sportlink.event.dto;

import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public record EventUpdateRequest(
        @Size(max=160) String title,
        @Size(max=64)  String sport,
        String description,
        OffsetDateTime startsAt,
        Integer durationMin,
        Integer capacity,
        Boolean waitlistEnabled,
        EventAccess access,
        EventAdmission admission,
        String recurrenceRule,
        OffsetDateTime registrationDeadline,
        Double locationLat,
        Double locationLon
) {}
