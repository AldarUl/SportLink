package com.sportlink.attendance.service;

import com.sportlink.attendance.dto.AttendanceMarkRequest;
import com.sportlink.attendance.dto.AttendanceResponse;
import com.sportlink.attendance.model.AttendanceStatus;

import java.util.List;
import java.util.UUID;

public interface AttendanceService {
    AttendanceResponse mark(UUID eventId, UUID requesterId, AttendanceMarkRequest req);

    AttendanceResponse markMe(UUID eventId, UUID requesterId, AttendanceStatus status);

    AttendanceResponse getMe(UUID eventId, UUID requesterId);

    List<AttendanceResponse> list(UUID eventId, UUID requesterId);

    /**
     * Список пользователей, доступных для оценки.
     * 
     * Логика:
     * - организатор всегда может получить список;
     * - confirmed-участник может получить список только после того,
     *   как организатор отметил его как ATTENDED.
     * 
     * Возвращает userId (без requesterId).
     */
    List<UUID> rateable(UUID eventId, UUID requesterId);
}
