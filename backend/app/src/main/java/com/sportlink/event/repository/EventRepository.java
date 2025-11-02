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
import java.time.OffsetDateTime;

public interface EventRepository extends JpaRepository<Event, UUID>, JpaSpecificationExecutor<Event> {

    List<Event> findByKindOrderByStartsAtAsc(EventKind kind);

    // ТИКЕР: подобрать порциями, чтобы не упереться в большие выборки
    List<Event> findTop1000ByStatusAndStartsAtLessThanEqual(EventStatus status, OffsetDateTime now);

    List<Event> findTop1000ByStatus(EventStatus status);

    List<Event> findTop1000ByStatusAndStartsAtBefore(EventStatus status, OffsetDateTime before);

    Page<Event> findAll(Pageable pageable);
    Page<Event> findByStatus(EventStatus status, Pageable pageable);

    /** Пессимистическая блокировка записи события для операций со слотами */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.id = :id")
    Optional<Event> lockById(@Param("id") UUID id);

    long countByOrganizerIdAndStatusNotAndStartsAtAfter(UUID organizerId, EventStatus status, OffsetDateTime after);

    List<Event> findByOrganizerIdAndStatusNotAndStartsAtAfter(UUID organizerId, EventStatus status, OffsetDateTime after);

    Page<Event> findByStartsAtBefore(OffsetDateTime cutoff, Pageable pageable);

    Page<Event> findByOrganizerId(UUID organizerId, Pageable pageable);

    Page<Event> findByOrganizerIdAndStartsAtAfter(UUID organizerId,
                                                  java.time.OffsetDateTime after,
                                                  Pageable pageable);

    Page<Event> findByStatus(String status, Pageable pageable);

    @Query(value = """
        select * from event
        where status = 'PUBLISHED'
          and starts_at <= :now
          and (starts_at + (duration_min || ' minutes')::interval) > :now
        order by starts_at desc
        """,
            countQuery = """
        select count(*) from event
        where status = 'PUBLISHED'
          and starts_at <= :now
          and (starts_at + (duration_min || ' minutes')::interval) > :now
        """,
            nativeQuery = true)
    Page<Event> findStarted(@Param("now") OffsetDateTime now, Pageable pageable);

    @Query(value = """
        select * from event
        where status = 'PUBLISHED'
          and (starts_at + (duration_min || ' minutes')::interval) <= :now
        order by starts_at desc
        """,
            countQuery = """
        select count(*) from event
        where status = 'PUBLISHED'
          and (starts_at + (duration_min || ' minutes')::interval) <= :now
        """,
            nativeQuery = true)
    Page<Event> findFinished(@Param("now") OffsetDateTime now, Pageable pageable);


}
