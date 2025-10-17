package com.sportlink.review.service;

import com.sportlink.review.dto.ReviewCreateRequest;
import com.sportlink.review.dto.ReviewPage;
import com.sportlink.review.dto.ReviewResponse;

import java.util.UUID;

public interface ReviewService {
    ReviewResponse create(UUID authorId, ReviewCreateRequest req);
    ReviewPage listByEvent(UUID eventId, int page, int size);
}
