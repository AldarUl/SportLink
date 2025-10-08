package com.sportlink.event.dto;

import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.model.EventKind;
import jakarta.validation.constraints.*;

import java.time.OffsetDateTime;
import java.util.UUID;

public record EventCreateRequest(
        @NotNull EventKind kind,
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 64) String sport,
        @Size(max = 4000) String description,
        @NotNull OffsetDateTime startsAt,
        @Min(10) @Max(1440) Integer durationMin,
        @Min(1) Integer capacity,
        boolean waitlistEnabled,
        @NotNull EventAccess access,
        @NotNull EventAdmission admission,
        String recurrenceRule,
        OffsetDateTime registrationDeadline,
        @NotNull UUID organizerId,
        UUID clubId,
        Double locationLat,
        Double locationLon
) {}
