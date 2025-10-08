package com.sportlink.application.service;

import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;
import com.sportlink.application.model.Application;
import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.repository.EventRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ApplicationServiceImpl implements ApplicationService {

    private final ApplicationRepository appRepo;
    private final EventRepository eventRepo;
    private final com.sportlink.club.repository.ClubMemberRepository clubMemberRepository;

    @Override
    public ApplicationResponse apply(UUID eventId, UUID userId) {
        if (appRepo.existsByEventIdAndUserId(eventId, userId)) {
            throw new IllegalStateException("Already applied");
        }
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        ApplicationStatus target;
        if (e.getAdmission() == EventAdmission.AUTO) {
            long confirmed = appRepo.countByEventIdAndStatus(eventId, ApplicationStatus.CONFIRMED);
            if (confirmed < e.getCapacity()) {
                target = ApplicationStatus.CONFIRMED;
            } else if (e.isWaitlistEnabled()) {
                target = ApplicationStatus.WAITLISTED;
            } else {
                throw new IllegalStateException("No free slots");
            }
        } else {
            target = ApplicationStatus.PENDING;
        }

        if (e.getAccess() == com.sportlink.event.model.EventAccess.CLUB_ONLY) {
            if (e.getClubId() == null || !clubMemberRepository.existsByClubIdAndUserId(e.getClubId(), userId)) {
                throw new org.springframework.security.access.AccessDeniedException("Only club members can apply");
            }
        }

        Application a = appRepo.save(Application.builder()
                .eventId(eventId).userId(userId).status(target).build());
        return toDto(a);
    }

    @Override
    public ApplicationResponse confirm(UUID applicationId, UUID organizerId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));
        Event e = eventRepo.findById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        requireOrganizer(e, organizerId);

        if (a.getStatus() == ApplicationStatus.CONFIRMED) {
            return toDto(a);
        }
        if (a.getStatus() == ApplicationStatus.DECLINED) {
            throw new IllegalStateException("Already declined");
        }

        long confirmed = appRepo.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
        if (confirmed >= e.getCapacity()) {
            throw new IllegalStateException("No free slots");
        }

        a.setStatus(ApplicationStatus.CONFIRMED);
        a = appRepo.save(a);
        return toDto(a);
    }

    @Override
    public ApplicationResponse decline(UUID applicationId, UUID organizerId) {
        Application a = appRepo.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("Application not found"));
        Event e = eventRepo.findById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        requireOrganizer(e, organizerId);

        if (a.getStatus() == ApplicationStatus.DECLINED) {
            return toDto(a);
        }
        // Снимаем подтверждение/ожидание → место может освободиться
        boolean wasConfirmed = a.getStatus() == ApplicationStatus.CONFIRMED;
        a.setStatus(ApplicationStatus.DECLINED);
        appRepo.save(a);

        if (wasConfirmed && e.isWaitlistEnabled()) {
            promoteFromWaitlistIfPossible(e);
        }
        return toDto(a);
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationPage listByEvent(UUID eventId, int page, int size, UUID organizerId) {
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        requireOrganizer(e, organizerId);
        var p = appRepo.findByEventId(eventId, PageRequest.of(page, size));
        var content = p.map(this::toDto).toList();
        return new ApplicationPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Override
    @Transactional(readOnly = true)
    public ApplicationPage listMy(UUID userId, int page, int size) {
        var p = appRepo.findByUserId(userId, PageRequest.of(page, size));
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
        Event e = eventRepo.findById(a.getEventId())
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));

        boolean wasConfirmed = a.getStatus() == ApplicationStatus.CONFIRMED;
        // Для простоты помечаем как DECLINED (без нового статуса WITHDRAWN)
        a.setStatus(ApplicationStatus.DECLINED);
        appRepo.save(a);

        if (wasConfirmed && e.isWaitlistEnabled()) {
            promoteFromWaitlistIfPossible(e);
        }
    }

    /* helpers */

    private void promoteFromWaitlistIfPossible(Event e) {
        long confirmed = appRepo.countByEventIdAndStatus(e.getId(), ApplicationStatus.CONFIRMED);
        if (confirmed >= e.getCapacity()) return;

        appRepo.findFirstByEventIdAndStatusOrderByCreatedAtAsc(e.getId(), ApplicationStatus.WAITLISTED)
                .ifPresent(wait -> {
                    wait.setStatus(ApplicationStatus.CONFIRMED);
                    appRepo.save(wait);
                });
    }

    private void requireOrganizer(Event e, UUID organizerId) {
        if (!e.getOrganizerId().equals(organizerId)) {
            throw new IllegalArgumentException("Only organizer can manage applications");
        }
    }

    private ApplicationResponse toDto(Application a) {
        return new ApplicationResponse(a.getId(), a.getEventId(), a.getUserId(), a.getStatus());
    }
}
