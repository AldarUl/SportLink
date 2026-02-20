package com.sportlink.application.service;

import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;
import com.sportlink.application.dto.ApplicationWithEventResponse;
import com.sportlink.application.dto.EventShortResponse;
import com.sportlink.application.model.Application;
import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.event.mapper.EventMapper;
import com.sportlink.notification.service.NotificationService;
import com.sportlink.user.repository.UserSportSkillRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ApplicationServiceImpl implements ApplicationService {

    private final ApplicationRepository appRepo;
    private final EventRepository eventRepo;
    private final EventMapper eventMapper;
    private final com.sportlink.club.repository.ClubMemberRepository clubMemberRepository;
    private final NotificationService notificationService;
    private final UserSportSkillRepository userSportSkillRepository;

    @Override
    public ApplicationResponse apply(UUID eventId, UUID userId) {
        // Лочим событие
        Event e = eventRepo.lockById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        var now = OffsetDateTime.now(); // можно оставить так; хочешь — сделай now(ZoneOffset.UTC)

        // базовые валидаторы
        if (e.getStartsAt().isBefore(now)) {
            throw new IllegalStateException("Event already started");
        }
        if (e.getRegistrationDeadline() != null && !now.isBefore(e.getRegistrationDeadline())) {
            throw new IllegalStateException("Registration is closed");
        }
        if (e.getAccess() == EventAccess.CLUB_ONLY) {
            if (e.getClubId() == null || !clubMemberRepository.existsByClubIdAndUserId(e.getClubId(), userId)) {
                throw new org.springframework.security.access.AccessDeniedException("Only club members can apply");
            }
        }
        if (hasTimeConflict(userId, e)) {
            throw new IllegalStateException("Time conflict with another confirmed event");
        }

        // идемпотентность + разрешаем re-apply после DECLINED
        var existingOpt = appRepo.findByEventIdAndUserId(eventId, userId);
        if (existingOpt.isPresent()) {
            Application a = existingOpt.get();

            if (a.getStatus() == ApplicationStatus.DECLINED) {
                // разрешаем повторную подачу: пересчитываем целевой статус
                ApplicationStatus target = computeTargetStatus(e);
                a.setStatus(target);
                a = appRepo.save(a);
                notificationService.applicationSubmitted(eventId, userId);
                return toDto(a);
            }

            // уже есть активная/ожидающая/лист ожидания — просто вернуть
            return toDto(a);
        }

        if (e.getLevelMin() != null && e.getLevelMax() != null) {
            var lvlOpt = userSportSkillRepository
                    .findByUserIdAndSportIgnoreCase(userId, e.getSport())
                    .map(s -> s.getLevel());

            if (lvlOpt.isEmpty()) {
                throw new IllegalStateException("Укажите свой уровень по спорту " + e.getSport() + " в профиле");
            }

            short lvl = lvlOpt.get();
            if (lvl < e.getLevelMin() || lvl > e.getLevelMax()) {
                throw new IllegalStateException("Ваш уровень (" + lvl + ") не соответствует требованию события (" +
                        e.getLevelMin() + "–" + e.getLevelMax() + ")");
            }
        }


        // новой заявки ещё нет — создаём
        ApplicationStatus target = computeTargetStatus(e);
        Application a = appRepo.save(Application.builder()
                .eventId(eventId)
                .userId(userId)
                .status(target)
                .build());

        notificationService.applicationSubmitted(eventId, userId);
        return toDto(a);
    }

    /** Вычисляем статус при подаче с учётом admission/capacity/waitlist */
    private ApplicationStatus computeTargetStatus(Event e) {
        Integer cap = e.getCapacity();
        if (e.getAdmission() == EventAdmission.AUTO) {
            if (cap == null) return ApplicationStatus.CONFIRMED;

            long confirmed = appRepo.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
            if (confirmed < cap) return ApplicationStatus.CONFIRMED;

            if (e.isWaitlistEnabled()) return ApplicationStatus.WAITLISTED;
            throw new IllegalStateException("No free slots");
        } else {
            // MANUAL — всегда PENDING, вместимость проверяется на confirm()
            return ApplicationStatus.PENDING;
        }
    }


    @Override
    public ApplicationResponse confirm(UUID applicationId, UUID organizerId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));

        // Блокируем событие перед изменением слотов
        Event e = eventRepo.lockById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        requireOrganizer(e, organizerId);

        var now = OffsetDateTime.now();
        if (e.getStartsAt().isBefore(now)) {
            throw new IllegalStateException("Event already started");
        }

        // Идемпотентность
        if (a.getStatus() == ApplicationStatus.CONFIRMED) {
            return toDto(a);
        }

        // ❗ВАЖНО: больше НЕ запрещаем confirm после DECLINED

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

        var now = OffsetDateTime.now();
        if (e.getStartsAt().isBefore(now)) {
            throw new IllegalStateException("Event already started");
        }

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
    @Transactional(readOnly = true)
    public List<ApplicationWithEventResponse> listMine(UUID userId) {
        var apps = appRepo.findByUserId(userId);
        if (apps == null || apps.isEmpty()) return List.of();

        var eventIds = apps.stream()
                .map(Application::getEventId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        var events = eventRepo.findAllById(eventIds);
        Map<UUID, Event> byId = events.stream()
                .collect(Collectors.toMap(Event::getId, e -> e));

        return apps.stream()
                .map(a -> {
                    Event e = byId.get(a.getEventId());
                    if (e == null) return null;

                    var er = eventMapper.toResponse(e);

                    var shortEv = new EventShortResponse(
                            er.id(),
                            er.kind(),
                            er.title(),
                            er.sport(),
                            er.startsAt(),
                            er.durationMin(),
                            er.status(),
                            er.launchedAt(),
                            er.access(),
                            er.admission(),
                            er.capacity(),
                            er.locationLat(),
                            er.locationLon()
                    );

                    return new ApplicationWithEventResponse(
                            a.getId(),
                            a.getEventId(),
                            a.getUserId(),
                            a.getStatus(),
                            a.getCreatedAt(),
                            shortEv
                    );
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing((ApplicationWithEventResponse r) -> r.event().startsAt(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Override
    @Transactional
    public void withdraw(UUID applicationId, UUID userId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));
        if (!a.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Only applicant can withdraw");
        }

        // Лочим событие, чтобы корректно освободить слот
        Event e = eventRepo.lockById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        boolean wasConfirmed = a.getStatus() == ApplicationStatus.CONFIRMED;

        // ⬇️ вместо a.setStatus(DECLINED) — просто удаляем
        appRepo.delete(a);

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

        if (target.getStartsAt() == null || target.getDurationMin() == null) return false;
        var targetStart = target.getStartsAt();
        var targetEnd   = targetStart.plusMinutes(target.getDurationMin());

        for (var a : confirmed) {
            if (target.getId() != null && a.getEventId() != null && a.getEventId().equals(target.getId())) continue;

            var other = eventRepo.findById(a.getEventId()).orElse(null);
            if (other == null) continue;

            // Cancelled/finished events must not block joining another event
            if (other.getStatus() == EventStatus.CANCELLED || other.getStatus() == EventStatus.FINISHED) continue;

            if (other.getStartsAt() == null || other.getDurationMin() == null) continue;
            var otherStart = other.getStartsAt();
            var otherEnd   = otherStart.plusMinutes(other.getDurationMin());

            boolean overlap = !targetEnd.isBefore(otherStart) && !otherEnd.isBefore(targetStart);
            if (overlap) return true;
        }
        return false;
    }
}
