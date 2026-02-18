package com.sportlink.attendance.dto;

import com.sportlink.attendance.model.AttendanceStatus;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AttendanceMarkRequest(
        @NotNull UUID userId,
        @NotNull AttendanceStatus status
) {}
