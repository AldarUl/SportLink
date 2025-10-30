package com.sportlink.review.dto;

import jakarta.validation.constraints.*;

import java.util.UUID;

public record ReviewCreateRequest(
        @NotNull UUID eventId,
        @Min(1) @Max(5) int rating,
        @Size(max = 2000) String comment
) {}
