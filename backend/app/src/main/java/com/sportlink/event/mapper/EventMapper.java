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
                resolveLiveStatus(e, OffsetDateTime.now()), // status (ручной старт)
                e.getLevelMin(),                            // NEW
                e.getLevelMax(),                             // NEW
                e.getLaunchedAt(),
                e.getLaunchedBy()
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

    /**
     * “Живой” статус для UI.
     * Требование: событие НЕ должно автоматически становиться STARTED по startsAt.
     * STARTED возможен только после ручного запуска (launchedAt != null).
     */
    private EventStatus resolveLiveStatus(Event e, OffsetDateTime now) {
        // Явные статусы из БД имеют приоритет.
        // Важно: ручное завершение должно сразу отражаться в UI,
        // даже если (launchedAt + durationMin) ещё "не прошло".
        if (e.getStatus() == EventStatus.CANCELLED) return EventStatus.CANCELLED;
        if (e.getStatus() == EventStatus.FINISHED) return EventStatus.FINISHED;

        // Если не запускали вручную — событие остаётся PUBLISHED (даже если startsAt уже прошёл).
        if (e.getLaunchedAt() == null) {
            // DRAFT сейчас в БД почти не используется, но оставим на всякий случай.
            if (e.getStatus() == EventStatus.DRAFT) return EventStatus.DRAFT;
            return EventStatus.PUBLISHED;
        }

        // После ручного запуска STARTED/FINISHED считаем по launchedAt + durationMin.
        // Если статус в БД STARTED — можем показать FINISHED по времени ещё до шедулера.
        var dur = e.getDurationMin();
        if (dur == null) return EventStatus.STARTED;

        var endsAt = e.getLaunchedAt().plusMinutes(dur.longValue());
        if (now.isBefore(endsAt)) return EventStatus.STARTED;
        return EventStatus.FINISHED;
    }
}
