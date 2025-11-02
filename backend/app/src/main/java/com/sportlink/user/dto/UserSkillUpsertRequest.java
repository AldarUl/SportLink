package com.sportlink.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UserSkillUpsertRequest(
        @NotNull @Min(1) @Max(5) Short level
) {}
