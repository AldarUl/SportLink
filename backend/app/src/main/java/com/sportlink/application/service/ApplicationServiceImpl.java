package com.sportlink.application.service;

import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;
import com.sportlink.application.model.Application;
import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.notification.service.NotificationService;
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
public class ApplicationServiceImpl implements ApplicationService {

    private final ApplicationRepository appRepo;
    private final EventRepository eventRepo;
    private final com.sportlink.club.repository.ClubMemberRepository clubMemberRepository;
    private final NotificationService notificationService;

    @Override
    public ApplicationResponse apply(UUID eventId, UUID userId) {
        // Идемпотентность: если уже есть заявка — вернуть её
        var existing = appRepo.findByEventIdAndUserId(eventId, userId);
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        // Блокируем событие на время расчёта слотов
        Event e = eventRepo.lockById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        var now = OffsetDateTime.now();
        if (e.getStartsAt().isBefore(now)) {
            throw new IllegalStateException("Event already started");
        }
        if (e.getRegistrationDeadline() != null && !now.isBefore(e.getRegistrationDeadline())) {
            throw new IllegalStateException("Registration is closed");
        }

        // клубный доступ
        if (e.getAccess() == EventAccess.CLUB_ONLY) {
            if (e.getClubId() == null || !clubMemberRepository.existsByClubIdAndUserId(e.getClubId(), userId)) {
                throw new org.springframework.security.access.AccessDeniedException("Only club members can apply");
            }
        }

        // конфликт по времени с уже подтверждёнными у пользователя
        if (hasTimeConflict(userId, e)) {
            throw new IllegalStateException("Time conflict with another confirmed event");
        }

        // выбор статуса с учётом capacity
        ApplicationStatus target;
        Integer cap = e.getCapacity(); // null -> безлимит
        if (e.getAdmission() == EventAdmission.AUTO) {
            if (cap == null) {
                target = ApplicationStatus.CONFIRMED;
            } else {
                long confirmed = appRepo.countByEventIdAndStatus(eventId, ApplicationStatus.CONFIRMED);
                if (confirmed < cap) {
                    target = ApplicationStatus.CONFIRMED;
                } else if (e.isWaitlistEnabled()) {
                    target = ApplicationStatus.WAITLISTED;
                } else {
                    throw new IllegalStateException("No free slots");
                }
            }
        } else {
            target = ApplicationStatus.PENDING;
        }

        Application a = appRepo.save(Application.builder()
                .eventId(eventId).userId(userId).status(target).build());

        notificationService.applicationSubmitted(eventId, userId);
        return toDto(a);
    }

    @Override
    public ApplicationResponse confirm(UUID applicationId, UUID organizerId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));

        // Блокируем событие перед изменением слотов
        Event e = eventRepo.lockById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        requireOrganizer(e, organizerId);

        if (a.getStatus() == ApplicationStatus.CONFIRMED) {
            return toDto(a);
        }
        if (a.getStatus() == ApplicationStatus.DECLINED) {
            throw new IllegalStateException("Already declined");
        }

        Integer cap = e.getCapacity();
        if (cap != null) {
            long confirmed = appRepo.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
            if (confirmed >= cap) {
                throw new IllegalStateException("No free slots");
            }
        }

        a.setStatus(ApplicationStatus.CONFIRMED);
        a = appRepo.save(a);
        notificationService.applicationConfirmed(e.getId(), a.getUserId());
        return toDto(a);
    }

    @Override
    public ApplicationResponse decline(UUID applicationId, UUID organizerId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));

        // Блокируем событие перед освобождением слота
        Event e = eventRepo.lockById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        requireOrganizer(e, organizerId);

        if (a.getStatus() == ApplicationStatus.DECLINED) {
            return toDto(a);
        }

        boolean wasConfirmed = a.getStatus() == ApplicationStatus.CONFIRMED;
        a.setStatus(ApplicationStatus.DECLINED);
        appRepo.save(a);

        if (wasConfirmed && e.isWaitlistEnabled()) {
            promoteFromWaitlistIfPossible(e);
        }
        notificationService.applicationDeclined(e.getId(), a.getUserId());
        return toDto(a);
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationPage listByEvent(UUID eventId, int page, int size, UUID organizerId) {
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        requireOrganizer(e, organizerId);

        // ограничим page size, чтобы избежать перегруза API
        int capped = Math.min(Math.max(size, 1), 100);
        var p = appRepo.findByEventId(eventId, PageRequest.of(page, capped));
        var content = p.map(this::toDto).toList();
        return new ApplicationPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationPage listMy(UUID userId, int page, int size) {
        int capped = Math.min(Math.max(size, 1), 100);
        var p = appRepo.findByUserId(userId, PageRequest.of(page, capped));
        var content = p.map(this::toDto).toList();
        return new ApplicationPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Override
    public void withdraw(UUID applicationId, UUID userId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));
        if (!a.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Only applicant can withdraw");
        }

        // Блокируем событие перед освобождением слота
        Event e = eventRepo.lockById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        boolean wasConfirmed = a.getStatus() == ApplicationStatus.CONFIRMED;
        a.setStatus(ApplicationStatus.DECLINED); // без отдельного статуса WITHDRAWN
        appRepo.save(a);

        if (wasConfirmed && e.isWaitlistEnabled()) {
            promoteFromWaitlistIfPossible(e);
        }
        notificationService.applicationWithdrawn(e.getId(), a.getUserId());
    }

    /* helpers */

    /** Добираем из waitlist пока есть свободные места */
    private void promoteFromWaitlistIfPossible(Event e) {
        Integer cap = e.getCapacity();
        if (cap == null) return; // безлимит — промоция не нужна

        while (true) {
            long confirmed = appRepo.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
            if (confirmed >= cap) return;

            var nextOpt = appRepo.findFirstByEventIdAndStatusOrderByCreatedAtAsc(
                    e.getId(), ApplicationStatus.WAITLISTED);
            if (nextOpt.isEmpty()) return;

            var wait = nextOpt.get();
            wait.setStatus(ApplicationStatus.CONFIRMED);
            appRepo.save(wait);
            notificationService.applicationConfirmed(e.getId(), wait.getUserId());
        }
    }

    private void requireOrganizer(Event e, UUID organizerId) {
        if (!e.getOrganizerId().equals(organizerId)) {
            throw new IllegalArgumentException("Only organizer can manage applications");
        }
    }

    private ApplicationResponse toDto(Application a) {
        return new ApplicationResponse(a.getId(), a.getEventId(), a.getUserId(), a.getStatus());
        // при необходимости дополни метаданными (timestamps и т.п.)
    }

    /** простая проверка пересечения интервалов с CONFIRMED-мероприятиями пользователя */
    private boolean hasTimeConflict(UUID userId, Event target) {
        var confirmed = appRepo.findByUserIdAndStatus(userId, ApplicationStatus.CONFIRMED);
        if (confirmed.isEmpty()) return false;

        var targetStart = target.getStartsAt();
        var targetEnd   = target.getStartsAt().plusMinutes(target.getDurationMin());

        for (var a : confirmed) {
            var other = eventRepo.findById(a.getEventId()).orElse(null);
            if (other == null) continue;
            var otherStart = other.getStartsAt();
            var otherEnd   = other.getStartsAt().plusMinutes(other.getDurationMin());
            boolean overlap = !targetEnd.isBefore(otherStart) && !otherEnd.isBefore(targetStart);
            if (overlap) return true;
        }
        return false;
    }
}
