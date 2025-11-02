package com.sportlink.event.admin.service;

import com.sportlink.event.admin.dto.PageResponseAdminEvent;
import com.sportlink.event.admin.mapper.AdminEventMapper;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
import jakarta.annotation.Nullable;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminEventService {

    private final EventRepository eventRepository;
    private final AdminEventMapper adminEventMapper;

    public PageResponseAdminEvent events(@Nullable EventStatus status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startsAt"));
        Page<Event> pg = (status == null)
                ? eventRepository.findAll(pageable)
                : eventRepository.findByStatus(status, pageable);  // см. репозиторий ниже

        return adminEventMapper.toPage(pg);
    }
}
