package com.sportlink.admin.service;

import com.sportlink.admin.dto.*;
import com.sportlink.admin.mapper.AdminMapper;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.auth.repository.RefreshTokenRepository;
import com.sportlink.event.admin.dto.AdminEvent;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepo;
    private final EventRepository eventRepo;
    private final ApplicationRepository appRepo;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    @Transactional(readOnly = true)
    public AdminSummary summary() {
        return new AdminSummary(userRepo.count(), eventRepo.count(), appRepo.count());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminUser> listUsers(Pageable pageable) {
        Page<com.sportlink.user.model.User> p = userRepo.findAll(pageable);
        var content = p.map(AdminMapper::toAdminUser).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminEvent> listEvents(EventStatus status, Pageable pageable) {
        Page<Event> p = (status == null)
                ? eventRepo.findAll(pageable)
                : eventRepo.findByStatus(status, pageable);
        var content = p.map(AdminMapper::toAdminEvent).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Override
    public void blockUser(UUID userId) {
        User u = userRepo.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (!u.isBlocked()) {
            u.setBlocked(true);
            userRepo.save(u);
            // чтобы пользователь не мог обновить access через refresh-cookie
            refreshTokenRepository.deleteByUserId(u.getId());
        }
    }

    @Override
    public void unblockUser(UUID userId) {
        User u = userRepo.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (u.isBlocked()) {
            u.setBlocked(false);
            userRepo.save(u);
        }
    }

    @Override
    public void hideEvent(UUID eventId) {
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (e.getStatus() != EventStatus.DRAFT) {
            e.setStatus(EventStatus.DRAFT);
            eventRepo.save(e);
        }
    }

    @Override
    public void deleteEvent(UUID eventId) {
        if (!eventRepo.existsById(eventId)) {
            throw new EntityNotFoundException("Event not found");
        }
        eventRepo.deleteById(eventId);
    }

    @Override
    public void cancelEvent(UUID eventId) {
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (e.getStatus() != EventStatus.CANCELLED) {
            e.setStatus(EventStatus.CANCELLED);
            eventRepo.save(e);
        }
    }

    @Override
    public void publishEvent(UUID eventId) {
        Event e = eventRepo.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (e.getStatus() != EventStatus.PUBLISHED) {
            e.setStatus(EventStatus.PUBLISHED);
            eventRepo.save(e);
        }
    }
}
