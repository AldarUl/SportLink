package com.sportlink.attendance.repository;

import com.sportlink.attendance.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    Optional<Attendance> findByEventIdAndUserId(UUID eventId, UUID userId);
    List<Attendance> findByEventId(UUID eventId);
}
