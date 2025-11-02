package com.sportlink.event.service;

import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
public class EventStatusResolver {
    public EventStatus resolve(Event e, OffsetDateTime now) {
        if (e.getStatus() == EventStatus.CANCELLED) return EventStatus.CANCELLED;
        // DRAFT пока не храним — трактуем как PUBLISHED/логику ниже
        var end = e.getStartsAt().plusMinutes(e.getDurationMin());
        if (now.isBefore(e.getStartsAt())) return EventStatus.PUBLISHED;
        if (now.isBefore(end))             return EventStatus.STARTED;
        return EventStatus.FINISHED;
    }
}
