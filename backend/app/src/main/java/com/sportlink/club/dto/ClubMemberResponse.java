package com.sportlink.club.dto;

import com.sportlink.club.model.ClubMemberRole;

import java.util.UUID;

public record ClubMemberResponse(UUID userId, ClubMemberRole role) {}
