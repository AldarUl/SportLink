package com.sportlink.club.dto;

import java.util.List;

public record ClubMemberPage(
        List<ClubMemberResponse> content,
        int page, int size, long totalElements, int totalPages, boolean last
) {}
