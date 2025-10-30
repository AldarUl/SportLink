package com.sportlink.event.dto;

import java.util.List;

public record EventPage(
        List<EventResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {}
