package com.sportlink.admin.service;

import com.sportlink.admin.dto.*;
import com.sportlink.admin.mapper.AdminMapper;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
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
