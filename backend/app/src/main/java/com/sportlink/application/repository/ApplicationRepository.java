package com.sportlink.application.repository;

import com.sportlink.application.model.Application;
import com.sportlink.application.model.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

import java.util.Optional;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    long countByEventIdAndStatus(UUID eventId, ApplicationStatus status);

    Page<Application> findByEventId(UUID eventId, Pageable pageable);

    Page<Application> findByUserId(UUID userId, Pageable pageable);

    boolean existsByEventIdAndUserId(UUID eventId, UUID userId);

    Optional<Application> findFirstByEventIdAndStatusOrderByCreatedAtAsc(UUID eventId, ApplicationStatus status);

    List<Application> findByUserIdAndStatus(UUID userId, ApplicationStatus status);
}
