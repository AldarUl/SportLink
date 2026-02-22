package com.sportlink.attendance.repository;

import com.sportlink.attendance.model.Attendance;
import com.sportlink.attendance.model.AttendanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    Optional<Attendance> findByEventIdAndUserId(UUID eventId, UUID userId);
    List<Attendance> findByEventId(UUID eventId);
    List<Attendance> findByEventIdAndStatus(UUID eventId, AttendanceStatus status);

    // кто пришёл и был отмечен конкретным пользователем (обычно организатором)
    List<Attendance> findByEventIdAndStatusAndMarkedBy(UUID eventId, AttendanceStatus status, UUID markedBy);
}
