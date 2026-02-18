package com.sportlink.review.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.attendance.model.AttendanceStatus;
import com.sportlink.attendance.repository.AttendanceRepository;
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
    private final AttendanceRepository attendanceRepo;

    @Override
    public ReviewResponse create(UUID authorId, ReviewCreateRequest req) {
        Event e = eventRepo.findById(req.eventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        // событие должно завершиться
        var endsAt = e.getStartsAt().plusMinutes(e.getDurationMin());
        if (!OffsetDateTime.now().isAfter(endsAt)) {
            throw new IllegalStateException("Event not finished yet");
        }

        // автор должен быть CONFIRMED участником (организатор у тебя всегда confirmed при создании)
        boolean participated = appRepo.existsByEventIdAndUserIdAndStatus(
                e.getId(), authorId, ApplicationStatus.CONFIRMED);
        if (!participated) {
            throw new org.springframework.security.access.AccessDeniedException("Only confirmed participants can leave a review");
        }

        // если автор отметил себя ABSENT — отзыв нельзя
        attendanceRepo.findByEventIdAndUserId(e.getId(), authorId).ifPresent(a -> {
            if (a.getStatus() == AttendanceStatus.ABSENT) {
                throw new IllegalStateException("ABSENT_CANNOT_REVIEW");
            }
        });

        boolean isOrganizer = e.getOrganizerId().equals(authorId);

        // правила "кто кого"
        if (!isOrganizer) {
            // участник может оценить только организатора
            if (!req.targetId().equals(e.getOrganizerId())) {
                throw new IllegalArgumentException("Participant can review only organizer");
            }
        } else {
            // организатор оценивает участников (кроме себя)
            if (req.targetId().equals(authorId)) {
                throw new IllegalArgumentException("Organizer cannot review self");
            }
            boolean targetIsConfirmed = appRepo.existsByEventIdAndUserIdAndStatus(
                    e.getId(), req.targetId(), ApplicationStatus.CONFIRMED
            );
            if (!targetIsConfirmed) {
                throw new IllegalArgumentException("Target must be a confirmed participant of this event");
            }
        }

        // один отзыв на пару (event, author, target)
        if (reviewRepo.existsByEventIdAndAuthorIdAndTargetId(e.getId(), authorId, req.targetId())) {
            throw new IllegalStateException("Review already exists");
        }

        Review r = reviewRepo.save(Review.builder()
                .eventId(e.getId())
                .authorId(authorId)
                .targetId(req.targetId())
                .rating(req.rating())
                .comment(req.comment())
                .build());

        return toDto(r);
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewPage listByEvent(UUID eventId, int page, int size) {
        return listByEvent(eventId, null, page, size);
    }

    @Transactional(readOnly = true)
    public ReviewPage listByEvent(UUID eventId, UUID targetId, int page, int size) {
        var pageable = PageRequest.of(page, size);

        var p = (targetId == null)
                ? reviewRepo.findByEventId(eventId, pageable)
                : reviewRepo.findByEventIdAndTargetId(eventId, targetId, pageable);

        var content = p.map(this::toDto).toList();
        Double avg = reviewRepo.averageRating(eventId, targetId);

        return new ReviewPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast(), avg);
    }

    private ReviewResponse toDto(Review r) {
        return new ReviewResponse(
                r.getId(), r.getEventId(), r.getAuthorId(), r.getTargetId(),
                r.getRating(), r.getComment(), r.getCreatedAt()
        );
    }
}
