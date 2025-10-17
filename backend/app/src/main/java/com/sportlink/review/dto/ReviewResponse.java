package com.sportlink.review.dto;

import java.time.Instant;
import java.util.UUID;

public record ReviewResponse(
        UUID id, UUID eventId, UUID authorId, int rating, String comment, Instant createdAt
) {}
