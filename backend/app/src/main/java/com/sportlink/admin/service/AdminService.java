package com.sportlink.admin.service;

import com.sportlink.admin.dto.*;
import com.sportlink.event.model.EventStatus;
import org.springframework.data.domain.Pageable;

public interface AdminService {
    AdminSummary summary();

    PageResponse<AdminUser> listUsers(Pageable pageable);

    PageResponse<AdminEvent> listEvents(EventStatus status, Pageable pageable);

    void cancelEvent(java.util.UUID eventId);

    void publishEvent(java.util.UUID eventId);
}
