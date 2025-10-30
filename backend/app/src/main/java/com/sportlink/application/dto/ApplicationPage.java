package com.sportlink.application.dto;

import java.util.List;

public record ApplicationPage(
        List<ApplicationResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {}
