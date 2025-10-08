package com.sportlink.club.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClubCreateRequest(
        @NotBlank @Size(max = 120) String name
) {}
