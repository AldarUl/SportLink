package com.sportlink.event.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.dto.EventCreateRequest;
import com.sportlink.event.dto.EventPage;
import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.dto.EventUpdateRequest;
import com.sportlink.event.model.*;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.notification.service.NotificationService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static com.sportlink.event.service.EventSpecifications.*;

@Service
@RequiredArgsConstructor
@Transactional
public class EventServiceImpl implements EventService {
    private static final int MAX_ACTIVE_ORG_EVENTS = 3; // лимит событий

    private final EventRepository eventRepository;
    private final com.sportlink.club.repository.ClubMemberRepository clubMemberRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationService notificationService;

    private static boolean overlaps(OffsetDateTime s1, Integer d1Min,
                                    OffsetDateTime s2, Integer d2Min) {
        if (s1 == null || d1Min == null || s2 == null || d2Min == null) return false;
        var e1 = s1.plusMinutes(d1Min.longValue());
        var e2 = s2.plusMinutes(d2Min.longValue());
        // [start, end)
        return s1.isBefore(e2) && s2.isBefore(e1);
    }

    private void ensureOrganizerLimit(UUID organizerId) {
        long active = eventRepository.countByOrganizerIdAndStatusNotAndStartsAtAfter(
                organizerId, EventStatus.CANCELLED, OffsetDateTime.now()
        );
        if (active >= MAX_ACTIVE_ORG_EVENTS) {
            throw new IllegalStateException("ORGANIZER_LIMIT_EXCEEDED: maximum " + MAX_ACTIVE_ORG_EVENTS + " future events");
        }
    }

    private void ensureNoOverlapOnCreate(UUID organizerId, OffsetDateTime start, Integer durMin) {
        var future = eventRepository.findByOrganizerIdAndStatusNotAndStartsAtAfter(
                organizerId, EventStatus.CANCELLED, OffsetDateTime.now()
        );
        for (var ex : future) {
            if (overlaps(start, durMin, ex.getStartsAt(), ex.getDurationMin()))
                throw new IllegalStateException("EVENT_TIME_OVERLAP: organizer already has an event overlapping in time");
        }
    }

    private void ensureNoOverlapOnUpdate(UUID organizerId, UUID updatingId,
                                         OffsetDateTime start, Integer durMin) {
        var future = eventRepository.findByOrganizerIdAndStatusNotAndStartsAtAfter(
                organizerId, EventStatus.CANCELLED, OffsetDateTime.now()
        );
        for (var ex : future) {
            if (ex.getId().equals(updatingId)) continue;
            if (overlaps(start, durMin, ex.getStartsAt(), ex.getDurationMin()))
                throw new IllegalStateException("EVENT_TIME_OVERLAP: organizer already has an event overlapping in time");
        }
    }

    private void validateCoords(Double lat, Double lon) {
        if (lat != null && (lat < -90 || lat > 90)) throw new IllegalArgumentException("locationLat is out of range");
        if (lon != null && (lon < -180 || lon > 180)) throw new IllegalArgumentException("locationLon is out of range");
    }



    @Override
    public EventResponse create(EventCreateRequest r, UUID organizerId) {
        if (r.kind() == EventKind.TRAINING && r.admission() != EventAdmission.MANUAL)
            throw new IllegalArgumentException("TRAINING must use MANUAL admission");
        if (r.kind() == EventKind.TRAINING && r.capacity() != null && r.capacity() > 50)
            throw new IllegalArgumentException("TRAINING capacity must be ≤ 50");

        if (r.access() == EventAccess.CLUB_ONLY) {
            if (r.clubId() == null) throw new IllegalArgumentException("clubId is required for CLUB_ONLY events");
            boolean isMember = clubMemberRepository.existsByClubIdAndUserId(r.clubId(), organizerId);
            if (!isMember) throw new IllegalArgumentException("Organizer must be a club member");
        }

        if (r.startsAt() == null || r.startsAt().isBefore(OffsetDateTime.now()))
            throw new IllegalArgumentException("startsAt must be in the future");
        if (r.durationMin() == null || r.durationMin() < 10 || r.durationMin() > 1440)
            throw new IllegalArgumentException("durationMin must be between 10 and 1440");
        if (r.registrationDeadline() != null && !r.registrationDeadline().isBefore(r.startsAt()))
            throw new IllegalArgumentException("registrationDeadline must be before startsAt");

        validateCoords(r.locationLat(), r.locationLon());

        // 🔒 новые бизнес-правила
        ensureOrganizerLimit(organizerId);
        ensureNoOverlapOnCreate(organizerId, r.startsAt(), r.durationMin());

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
                .organizerId(organizerId)
                .clubId(r.clubId())
                .locationLat(r.locationLat())
                .locationLon(r.locationLon())
                .status(EventStatus.PUBLISHED)
                .build();

        e = eventRepository.save(e);

        // автозапись организатора (CONFIRMED) — как было
        try {
            if (!applicationRepository.existsByEventIdAndUserId(e.getId(), organizerId)) {
                applicationRepository.save(
                        com.sportlink.application.model.Application.builder()
                                .eventId(e.getId())
                                .userId(organizerId)
                                .status(ApplicationStatus.CONFIRMED)
                                .build()
                );
            }
        } catch (org.springframework.dao.DataIntegrityViolationException ignore) {}

        notificationService.eventCreated(e.getId(), e.getTitle(), e.getOrganizerId());
        return toDto(e);
    }



    @Override
    @Transactional(readOnly = true)
    public EventResponse get(UUID id, UUID viewerId) {
        Event e = eventRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (e.getAccess() == EventAccess.CLUB_ONLY) {
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
                            java.util.UUID clubId,
                            Double minLat, Double minLon, Double maxLat, Double maxLon,
                            Double centerLat, Double centerLon,
                            int page, int size) {

        Specification<Event> spec = Specification.where(kind(kind))
                .and(sport(sport))
                .and(access(access))
                .and(admission(admission))
                .and(startsFrom(from))
                .and(startsTo(to))
                .and(club(clubId))
                .and(bbox(minLat, minLon, maxLat, maxLon))
                .and(orderByDistanceThenStart(centerLat, centerLon)); // задаст orderBy, если передан центр

        // Важно: сортировку по расстоянию мы задали в спецификации; Pageable оставляем без сортировки
        var pageable = org.springframework.data.domain.PageRequest.of(page, size);

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

        if (u.title() != null) e.setTitle(u.title());
        if (u.sport() != null) e.setSport(u.sport());
        if (u.description() != null) e.setDescription(u.description());
        if (u.startsAt() != null) e.setStartsAt(u.startsAt());
        if (u.startsAt() != null && u.startsAt().isBefore(OffsetDateTime.now()))
            throw new IllegalArgumentException("startsAt must be in the future");
        if (u.durationMin() != null && (u.durationMin() < 10 || u.durationMin() > 1440))
            throw new IllegalArgumentException("durationMin must be between 10 and 1440");
        if (u.registrationDeadline() != null && u.startsAt() != null
                && !u.registrationDeadline().isBefore(u.startsAt()))
            throw new IllegalArgumentException("registrationDeadline must be before startsAt");

        if (u.durationMin() != null) e.setDurationMin(u.durationMin());

        if (u.capacity() != null) {
            if (e.getKind() == EventKind.TRAINING && u.capacity() > 50)
                throw new IllegalArgumentException("TRAINING capacity must be ≤ 50");
            long confirmed = applicationRepository.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
            if (u.capacity() != null && u.capacity() > 0 && confirmed > u.capacity())
                throw new IllegalStateException("CAPACITY_TOO_SMALL: confirmed=" + confirmed + ", capacity=" + u.capacity());
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

        validateCoords(e.getLocationLat(), e.getLocationLon());

        // 🔒 запрет пересечений после применения апдейта
        ensureNoOverlapOnUpdate(e.getOrganizerId(), e.getId(), e.getStartsAt(), e.getDurationMin());

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
        if (e.getCapacity() == null) return true;
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

    @Override
    public void delete(UUID id, UUID currentUserId) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Event not found"));
        requireOrganizer(e, currentUserId);

        // запретить удаление начавшихся событий
        // requireNotStarted(e);

        eventRepository.deleteById(id);
    }

    // EventServiceImpl.java
    @Override
    @Transactional(readOnly = true)
    public EventPage my(UUID organizerId, boolean futureOnly, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startsAt"));
        var pg = futureOnly
                ? eventRepository.findByOrganizerIdAndStartsAtAfter(organizerId, OffsetDateTime.now(), pageable)
                : eventRepository.findByOrganizerId(organizerId, pageable);

        var content = pg.map(this::toDto).toList();
        return new EventPage(content, pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages(), pg.isLast());
    }
}
