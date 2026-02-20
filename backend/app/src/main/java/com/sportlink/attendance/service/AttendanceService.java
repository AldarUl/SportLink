package com.sportlink.attendance.service;

import com.sportlink.attendance.dto.AttendanceMarkRequest;
import com.sportlink.attendance.dto.AttendanceResponse;

import java.util.List;
import java.util.UUID;

public interface AttendanceService {
    AttendanceResponse mark(UUID eventId, UUID requesterId, AttendanceMarkRequest req);
    AttendanceResponse markMe(UUID eventId, UUID requesterId, com.sportlink.attendance.model.AttendanceStatus status);
    AttendanceResponse getMe(UUID eventId, UUID requesterId);
    List<AttendanceResponse> list(UUID eventId, UUID requesterId);
}
