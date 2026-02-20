package com.sportlink.attendance.service;

import com.sportlink.application.model.ApplicationStatus;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.attendance.dto.AttendanceMarkRequest;
import com.sportlink.attendance.dto.AttendanceResponse;
import com.sportlink.attendance.model.Attendance;
import com.sportlink.attendance.model.AttendanceStatus;
import com.sportlink.attendance.repository.AttendanceRepository;
import com.sportlink.event.repository.EventRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceRepository attendanceRepo;
    private final EventRepository eventRepo;
    private final ApplicationRepository appRepo;

    @Override
    public AttendanceResponse mark(UUID eventId, UUID requesterId, AttendanceMarkRequest req) {
        var e = eventRepo.findById(eventId).orElseThrow(() -> new EntityNotFoundException("Event not found"));

        boolean requesterIsOrganizer = e.getOrganizerId().equals(requesterId);
        if (!requesterIsOrganizer) {
            throw new org.springframework.security.access.AccessDeniedException("Only organizer can mark attendance for others");
        }

        // отмечать можно только участников (confirmed) и самого организатора
        if (!req.userId().equals(e.getOrganizerId())) {
            boolean confirmed = appRepo.existsByEventIdAndUserIdAndStatus(eventId, req.userId(), ApplicationStatus.CONFIRMED);
            if (!confirmed) throw new IllegalStateException("USER_NOT_CONFIRMED_PARTICIPANT");
        }

        Attendance a = attendanceRepo.findByEventIdAndUserId(eventId, req.userId())
                .orElseGet(() -> Attendance.builder().eventId(eventId).userId(req.userId()).build());

        a.setStatus(req.status());
        a.setMarkedBy(requesterId);

        a = attendanceRepo.save(a);
        return toDto(a);
    }

    @Override
    public AttendanceResponse markMe(UUID eventId, UUID requesterId, AttendanceStatus status) {
        var e = eventRepo.findById(eventId).orElseThrow(() -> new EntityNotFoundException("Event not found"));

        // должен быть confirmed участником (или организатором)
        if (!e.getOrganizerId().equals(requesterId)) {
            boolean confirmed = appRepo.existsByEventIdAndUserIdAndStatus(eventId, requesterId, ApplicationStatus.CONFIRMED);
            if (!confirmed) throw new org.springframework.security.access.AccessDeniedException("Only confirmed participants can mark themselves");
        }

        Attendance a = attendanceRepo.findByEventIdAndUserId(eventId, requesterId)
                .orElseGet(() -> Attendance.builder().eventId(eventId).userId(requesterId).build());

        a.setStatus(status);
        a.setMarkedBy(requesterId);

        a = attendanceRepo.save(a);
        return toDto(a);
    }

    @Override
    @Transactional(readOnly = true)
    public AttendanceResponse getMe(UUID eventId, UUID requesterId) {
        var e = eventRepo.findById(eventId).orElseThrow(() -> new EntityNotFoundException("Event not found"));

        // должен быть confirmed участником (или организатором)
        if (!e.getOrganizerId().equals(requesterId)) {
            boolean confirmed = appRepo.existsByEventIdAndUserIdAndStatus(eventId, requesterId, ApplicationStatus.CONFIRMED);
            if (!confirmed) throw new org.springframework.security.access.AccessDeniedException("Only confirmed participants can view their attendance");
        }

        Attendance a = attendanceRepo.findByEventIdAndUserId(eventId, requesterId)
                .orElseThrow(() -> new EntityNotFoundException("Attendance not found"));

        return toDto(a);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceResponse> list(UUID eventId, UUID requesterId) {
        var e = eventRepo.findById(eventId).orElseThrow(() -> new EntityNotFoundException("Event not found"));
        if (!e.getOrganizerId().equals(requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException("Only organizer can view attendance list");
        }
        return attendanceRepo.findByEventId(eventId).stream().map(this::toDto).toList();
    }

    private AttendanceResponse toDto(Attendance a) {
        return new AttendanceResponse(a.getId(), a.getEventId(), a.getUserId(), a.getStatus(), a.getMarkedBy(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
