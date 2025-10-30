package com.sportlink.review.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.review.dto.*;
import com.sportlink.review.model.Review;
import com.sportlink.review.repository.ReviewRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepo;
    private final EventRepository eventRepo;
    private final ApplicationRepository appRepo;

    @Override
    public ReviewResponse create(UUID authorId, ReviewCreateRequest req) {
        Event e = eventRepo.findById(req.eventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        // событие должно завершиться
        var endsAt = e.getStartsAt().plusMinutes(e.getDurationMin());
        if (!OffsetDateTime.now().isAfter(endsAt)) {
            throw new IllegalStateException("Event not finished yet");
        }

        // автор должен быть подтверждённым участником
        boolean participated = appRepo.existsByEventIdAndUserIdAndStatus(
                e.getId(), authorId, ApplicationStatus.CONFIRMED);
        if (!participated) {
            throw new org.springframework.security.access.AccessDeniedException("Only participants can leave a review");
        }

        // один отзыв на пользователя
        if (reviewRepo.existsByEventIdAndAuthorId(e.getId(), authorId)) {
            throw new IllegalStateException("Review already exists");
        }

        Review r = reviewRepo.save(Review.builder()
                .eventId(e.getId())
                .authorId(authorId)
                .rating(req.rating())
                .comment(req.comment())
                .build());

        return toDto(r);
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewPage listByEvent(UUID eventId, int page, int size) {
        var p = reviewRepo.findByEventId(eventId, PageRequest.of(page, size));
        var content = p.map(this::toDto).toList();
        Double avg = reviewRepo.averageRating(eventId);
        return new ReviewPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast(), avg);
    }

    private ReviewResponse toDto(Review r) {
        return new ReviewResponse(r.getId(), r.getEventId(), r.getAuthorId(), r.getRating(), r.getComment(), r.getCreatedAt());
    }
}
