package com.sportlink.event.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.dto.EventCreateRequest;
import com.sportlink.event.dto.EventPage;
import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.dto.EventUpdateRequest;
import com.sportlink.event.model.*;
import com.sportlink.event.repository.EventRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static com.sportlink.event.service.EventSpecifications.*;

@Service
@RequiredArgsConstructor
@Transactional
public class EventServiceImpl implements EventService {
    private final EventRepository eventRepository;
    private final ApplicationRepository applicationRepository;
    private final com.sportlink.club.repository.ClubMemberRepository clubMemberRepository;


    @Override
    public EventResponse create(EventCreateRequest r) {
        // инварианты
        if (r.kind() == EventKind.TRAINING && r.admission() != EventAdmission.MANUAL)
            throw new IllegalArgumentException("TRAINING must use MANUAL admission");
        if (r.kind() == EventKind.TRAINING && r.capacity() != null && r.capacity() > 50)
            throw new IllegalArgumentException("TRAINING capacity must be ≤ 50");
        if (r.access() == EventAccess.CLUB_ONLY) {
            if (r.clubId() == null) throw new IllegalArgumentException("clubId is required for CLUB_ONLY events");
            boolean isMember = clubMemberRepository.existsByClubIdAndUserId(r.clubId(), r.organizerId());
            if (!isMember) throw new IllegalArgumentException("Organizer must be a club member");
        }

        Event e = Event.builder()
                .kind(r.kind())
                .title(r.title())
                .sport(r.sport())
                .description(r.description())
                .startsAt(r.startsAt())
                .durationMin(r.durationMin())
                .capacity(r.capacity())
                .waitlistEnabled(r.waitlistEnabled())
                .access(r.access())
                .admission(r.admission())
                .recurrenceRule(r.recurrenceRule())
                .registrationDeadline(r.registrationDeadline())
                .organizerId(r.organizerId())
                .clubId(r.clubId())
                .locationLat(r.locationLat())
                .locationLon(r.locationLon())
                .status(EventStatus.PUBLISHED)
                .build();

        e = eventRepository.save(e);
        return toDto(e);
    }

    @Override @Transactional(readOnly = true)
    public EventResponse get(UUID id, UUID viewerId) {
        Event e = eventRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (e.getAccess() == EventAccess.CLUB_ONLY) {
            // если не автор и не член клуба — 403
            if (viewerId == null || (!e.getOrganizerId().equals(viewerId)
                    && (e.getClubId() == null || !clubMemberRepository.existsByClubIdAndUserId(e.getClubId(), viewerId)))) {
                throw new org.springframework.security.access.AccessDeniedException("Club members only");
            }
        }
        return toDto(e);
    }


    @Override
    @Transactional(readOnly = true)
    public EventPage search(EventKind kind, String sport,
                            OffsetDateTime from, OffsetDateTime to,
                            EventAccess access, EventAdmission admission,
                            int page, int size) {
        Specification<Event> spec = Specification.where(kind(kind))
                .and(sport(sport))
                .and(access(access))
                .and(admission(admission))
                .and(startsFrom(from))
                .and(startsTo(to));

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startsAt"));
        var pg = eventRepository.findAll(spec, pageable);

        var content = pg.map(this::toDto).toList();
        return new EventPage(content, pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages(), pg.isLast());
    }

    @Override
    public EventResponse update(UUID id, UUID currentUserId, EventUpdateRequest u) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        requireOrganizer(e, currentUserId);
        requireNotStarted(e);

        // нельзя менять kind; остальные — по наличию значений
        if (u.title() != null) e.setTitle(u.title());
        if (u.sport() != null) e.setSport(u.sport());
        if (u.description() != null) e.setDescription(u.description());
        if (u.startsAt() != null) e.setStartsAt(u.startsAt());
        if (u.durationMin() != null) e.setDurationMin(u.durationMin());
        if (u.capacity() != null) {
            if (e.getKind() == EventKind.TRAINING && u.capacity() > 50)
                throw new IllegalArgumentException("TRAINING capacity must be ≤ 50");
            e.setCapacity(u.capacity());
        }
        if (u.waitlistEnabled() != null) e.setWaitlistEnabled(u.waitlistEnabled());
        if (u.access() != null) e.setAccess(u.access());
        if (u.admission() != null) {
            if (e.getKind() == EventKind.TRAINING && u.admission() != EventAdmission.MANUAL)
                throw new IllegalArgumentException("TRAINING must use MANUAL admission");
            e.setAdmission(u.admission());
        }
        if (u.recurrenceRule() != null) e.setRecurrenceRule(u.recurrenceRule());
        if (u.registrationDeadline() != null) e.setRegistrationDeadline(u.registrationDeadline());
        if (u.locationLat() != null) e.setLocationLat(u.locationLat());
        if (u.locationLon() != null) e.setLocationLon(u.locationLon());
        if (u.access() != null && u.access() == EventAccess.CLUB_ONLY) {
            if (e.getClubId() == null) throw new IllegalArgumentException("clubId is required for CLUB_ONLY events");
            boolean isMember = clubMemberRepository.existsByClubIdAndUserId(e.getClubId(), currentUserId);
            if (!isMember) throw new IllegalArgumentException("Organizer must be a club member");
        }

        e = eventRepository.save(e);
        return toDto(e);
    }

    @Override
    public void cancel(UUID id, UUID currentUserId) {
        Event e = eventRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Event not found"));
        requireOrganizer(e, currentUserId);
        if (e.getStatus() != EventStatus.CANCELLED) {
            e.setStatus(EventStatus.CANCELLED);
            eventRepository.save(e);
        }
    }

    @Override
    public void publish(UUID id, UUID currentUserId) {
        Event e = eventRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Event not found"));
        requireOrganizer(e, currentUserId);
        if (e.getStatus() != EventStatus.PUBLISHED) {
            e.setStatus(EventStatus.PUBLISHED);
            eventRepository.save(e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasFreeCapacity(UUID eventId) {
        var e = eventRepository.findById(eventId).orElseThrow();
        long confirmed = applicationRepository.countByEventIdAndStatus(eventId, ApplicationStatus.CONFIRMED);
        return confirmed < e.getCapacity();
    }

    /* helpers */
    private void requireOrganizer(Event e, UUID userId) {
        if (!e.getOrganizerId().equals(userId))
            throw new IllegalArgumentException("Only organizer can modify the event");
    }
    private void requireNotStarted(Event e) {
        if (e.getStartsAt() != null && e.getStartsAt().isBefore(OffsetDateTime.now()))
            throw new IllegalStateException("Event already started");
    }

    private EventResponse toDto(Event e) {
        return new EventResponse(
                e.getId(), e.getKind(), e.getTitle(), e.getSport(), e.getDescription(),
                e.getStartsAt(), e.getDurationMin(), e.getCapacity(), e.isWaitlistEnabled(),
                e.getAccess(), e.getAdmission(), e.getRecurrenceRule(), e.getRegistrationDeadline(),
                e.getOrganizerId(), e.getClubId(), e.getLocationLat(), e.getLocationLon(), e.getStatus()
        );
    }
}
