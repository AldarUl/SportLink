package com.sportlink.event.repository;

import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.model.EventStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID>, JpaSpecificationExecutor<Event> {
    List<Event> findByKindOrderByStartsAtAsc(EventKind kind);

    Page<Event> findAll(Pageable pageable);
    Page<Event> findByStatus(EventStatus status, Pageable pageable);
}
