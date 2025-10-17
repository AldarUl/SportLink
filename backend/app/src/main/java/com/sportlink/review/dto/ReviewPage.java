package com.sportlink.review.dto;

import java.util.List;

public record ReviewPage(
        List<ReviewResponse> content,
        int page, int size, long totalElements, int totalPages, boolean last,
        Double averageRating
) {}
