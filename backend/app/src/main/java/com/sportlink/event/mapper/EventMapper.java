package com.sportlink.event.mapper;

import com.sportlink.event.dto.EventPage;
import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

@Component
public class EventMapper {

    public EventResponse toResponse(Event e) {
        return new EventResponse(
                e.getId(),
                e.getKind(),
                e.getTitle(),
                e.getSport(),
                e.getDescription(),
                e.getStartsAt(),
                e.getDurationMin(),
                e.getCapacity(),
                e.isWaitlistEnabled(),
                e.getAccess(),
                e.getAdmission(),
                e.getRecurrenceRule(),
                e.getRegistrationDeadline(),
                e.getOrganizerId(),
                e.getClubId(),
                e.getLocationLat(),
                e.getLocationLon(),
                resolveLiveStatus(e, OffsetDateTime.now()), // status
                e.getLevelMin(),                            // NEW
                e.getLevelMax()                             // NEW
        );
    }

    public EventPage toPage(Page<Event> pg) {
        List<EventResponse> content = pg.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return new EventPage(
                content,
                pg.getNumber(),
                pg.getSize(),
                pg.getTotalElements(),
                pg.getTotalPages(),
                pg.isLast()
        );
    }

    /** “Живой” статус без изменения схемы БД: CANCELLED хранится как есть, остальное считаем по времени. */
    private EventStatus resolveLiveStatus(Event e, OffsetDateTime now) {
        if (e.getStatus() == EventStatus.CANCELLED) return EventStatus.CANCELLED;

        var startsAt = e.getStartsAt();
        var dur = e.getDurationMin();
        if (startsAt == null || dur == null) {
            return e.getStatus();
        }
        var endsAt = startsAt.plusMinutes(dur.longValue());
        if (now.isBefore(startsAt)) return EventStatus.PUBLISHED;
        if (now.isBefore(endsAt))   return EventStatus.STARTED;
        return EventStatus.FINISHED;
    }
}
