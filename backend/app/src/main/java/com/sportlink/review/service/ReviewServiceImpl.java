package com.sportlink.review.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.attendance.model.AttendanceStatus;
import com.sportlink.attendance.repository.AttendanceRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.review.dto.ReviewCreateRequest;
import com.sportlink.review.dto.ReviewPage;
import com.sportlink.review.dto.ReviewResponse;
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

        // Оценки доступны после завершения.
        // 1) если организатор вручную завершил событие (status=FINISHED) — сразу открываем оценки
        // 2) иначе — после окончания по времени (launchedAt/startsAt + duration)
        boolean finishedByStatus = e.getStatus() == EventStatus.FINISHED;
        if (!finishedByStatus) {
            var base = (e.getLaunchedAt() != null) ? e.getLaunchedAt() : e.getStartsAt();
            if (base == null || e.getDurationMin() == null) {
                throw new IllegalStateException("Event time is not defined");
            }
            var endsAt = base.plusMinutes(e.getDurationMin());
            if (!OffsetDateTime.now().isAfter(endsAt)) {
                throw new IllegalStateException("Event not finished yet");
            }
        }

        UUID organizerId = e.getOrganizerId();
        boolean authorIsOrganizer = organizerId.equals(authorId);

        // Автор должен быть CONFIRMED участником
        boolean participated = appRepo.existsByEventIdAndUserIdAndStatus(
                e.getId(), authorId, ApplicationStatus.CONFIRMED);
        if (!participated) {
            throw new org.springframework.security.access.AccessDeniedException("Only confirmed participants can leave a review");
        }

        // нельзя оценивать самого себя
        if (req.targetId().equals(authorId)) {
            throw new IllegalArgumentException("Cannot review self");
        }

        // цель должна быть CONFIRMED участником (или организатором)
        boolean targetIsConfirmed = req.targetId().equals(organizerId)
                || appRepo.existsByEventIdAndUserIdAndStatus(e.getId(), req.targetId(), ApplicationStatus.CONFIRMED);
        if (!targetIsConfirmed) {
            throw new IllegalArgumentException("Target must be a confirmed participant of this event");
        }

        // --- Бизнес-правило: оценка ТОЛЬКО после отметки посещаемости организатором.
        // Участник может оценивать только если:
        //  - организатор отметил его как ATTENDED (и markedBy = organizerId)
        //  - и, если оценивает не организатора, то цель также отмечена как ATTENDED организатором

        if (!authorIsOrganizer) {
            var my = attendanceRepo.findByEventIdAndUserId(e.getId(), authorId)
                    .orElseThrow(() -> new IllegalStateException("ATTENDANCE_NOT_MARKED_BY_ORGANIZER"));

            if (my.getStatus() == AttendanceStatus.ABSENT) {
                throw new IllegalStateException("ABSENT_CANNOT_REVIEW");
            }

            boolean ok = my.getStatus() == AttendanceStatus.ATTENDED && organizerId.equals(my.getMarkedBy());
            if (!ok) {
                throw new IllegalStateException("ATTENDANCE_NOT_MARKED_BY_ORGANIZER");
            }
        }

        // если цель НЕ организатор — она должна быть ATTENDED и отмечена организатором
        if (!req.targetId().equals(organizerId)) {
            var targetAtt = attendanceRepo.findByEventIdAndUserId(e.getId(), req.targetId())
                    .orElseThrow(() -> new IllegalStateException("TARGET_NOT_MARKED_BY_ORGANIZER"));

            if (targetAtt.getStatus() != AttendanceStatus.ATTENDED || !organizerId.equals(targetAtt.getMarkedBy())) {
                throw new IllegalStateException("TARGET_NOT_MARKED_BY_ORGANIZER");
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
