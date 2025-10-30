package com.sportlink.club.dto;

import java.util.UUID;

public record ClubResponse(UUID id, String name, UUID ownerId, long members) {}
