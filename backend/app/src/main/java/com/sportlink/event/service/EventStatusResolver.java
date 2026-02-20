package com.sportlink.event.service;

import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

/**
 * Ручной старт.
 * Событие НЕ должно автоматически становиться STARTED по расписанию (startsAt).
 * STARTED/FINISHED определяются только после ручного запуска (launchedAt != null).
 */
@Component
public class EventStatusResolver {

    public EventStatus resolve(Event e, OffsetDateTime now) {
        if (e.getStatus() == EventStatus.CANCELLED) return EventStatus.CANCELLED;

        // если не запускали вручную — остаётся PUBLISHED (даже если startsAt уже прошло)
        if (e.getLaunchedAt() == null) {
            if (e.getStatus() == EventStatus.DRAFT) return EventStatus.DRAFT;
            return EventStatus.PUBLISHED;
        }

        // после ручного запуска считаем STARTED/FINISHED по launchedAt + durationMin
        Integer dur = e.getDurationMin();
        if (dur == null) return EventStatus.STARTED;

        OffsetDateTime endsAt = e.getLaunchedAt().plusMinutes(dur.longValue());
        if (now.isBefore(endsAt)) return EventStatus.STARTED;
        return EventStatus.FINISHED;
    }
}