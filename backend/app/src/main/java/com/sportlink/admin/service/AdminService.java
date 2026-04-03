package com.sportlink.admin.service;

import com.sportlink.admin.dto.*;
import com.sportlink.event.admin.dto.AdminEvent;
import com.sportlink.event.model.EventStatus;
import org.springframework.data.domain.Pageable;

public interface AdminService {
    AdminSummary summary();

    PageResponse<AdminUser> listUsers(Pageable pageable);

    PageResponse<AdminEvent> listEvents(EventStatus status, Pageable pageable);

    void blockUser(java.util.UUID userId);

    void unblockUser(java.util.UUID userId);

    /** Снять с публикации (скрыть) событие/тренировку (переводим в DRAFT). */
    void hideEvent(java.util.UUID eventId);

    /** Удалить событие/тренировку (модерация). */
    void deleteEvent(java.util.UUID eventId);

    void cancelEvent(java.util.UUID eventId);

    void publishEvent(java.util.UUID eventId);
}
