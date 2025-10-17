package com.sportlink.event.repository;

import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.model.EventStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID>, JpaSpecificationExecutor<Event> {

    List<Event> findByKindOrderByStartsAtAsc(EventKind kind);

    Page<Event> findAll(Pageable pageable);
    Page<Event> findByStatus(EventStatus status, Pageable pageable);

    /** Пессимистическая блокировка записи события для операций со слотами */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.id = :id")
    Optional<Event> lockById(@Param("id") UUID id);
}
