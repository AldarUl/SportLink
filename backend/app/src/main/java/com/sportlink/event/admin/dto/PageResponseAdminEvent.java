package com.sportlink.event.admin.dto;

import java.util.List;

public record PageResponseAdminEvent(
        List<AdminEvent> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {}
