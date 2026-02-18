package com.sportlink.attendance.dto;

import com.sportlink.attendance.model.AttendanceStatus;

import java.time.Instant;
import java.util.UUID;

public record AttendanceResponse(
        UUID id, UUID eventId, UUID userId, AttendanceStatus status, UUID markedBy, Instant createdAt, Instant updatedAt
) {}
