// src/main/java/com/sportlink/event/service/EventLifecycleScheduler.java
package com.sportlink.event.service;

import com.sportlink.event.config.EventsProperties;
import com.sportlink.event.model.Event;
import com.sportlink.event.model.EventStatus;
import com.sportlink.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class EventLifecycleScheduler {

    private final EventRepository eventRepository;
    private final EventsProperties props;

    // cron можно оставить фиксированным раз в минуту;
    // если захочешь сделать настраиваемым — см. примечание ниже.
    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void tick() {
        if (!props.isLifecycleEnabled()) return;

        OffsetDateTime now = OffsetDateTime.now();

        int started  = promoteToStarted(now);
        int finished = promoteToFinished(now);
        int cleaned  = cleanupFinishedOlderThanDays(props.getRetentionDays(), now);

        if (started + finished + cleaned > 0) {
            log.info("lifecycle: started={}, finished={}, cleaned={} (retentionDays={})",
                    started, finished, cleaned, props.getRetentionDays());
        }
    }

    private int promoteToStarted(OffsetDateTime now) {
        int total = 0;
        while (true) {
            List<Event> batch = eventRepository
                    .findTop1000ByStatusAndStartsAtLessThanEqual(EventStatus.PUBLISHED, now);
            if (batch.isEmpty()) break;
            for (Event e : batch) {
                if (e.getStartsAt() != null && !e.getStartsAt().isAfter(now)) {
                    e.setStatus(EventStatus.STARTED);
                }
            }
            eventRepository.saveAll(batch);
            total += batch.size();
        }
        return total;
    }

    private int promoteToFinished(OffsetDateTime now) {
        int total = 0;
        while (true) {
            List<Event> batch = eventRepository.findTop1000ByStatus(EventStatus.STARTED);
            if (batch.isEmpty()) break;

            List<Event> toSave = new ArrayList<>(batch.size());
            for (Event e : batch) {
                if (e.getStartsAt() == null || e.getDurationMin() == null) continue;
                OffsetDateTime end = e.getStartsAt().plusMinutes(e.getDurationMin());
                if (!end.isAfter(now)) {
                    e.setStatus(EventStatus.FINISHED);
                    toSave.add(e);
                }
            }
            if (!toSave.isEmpty()) {
                eventRepository.saveAll(toSave);
                total += toSave.size();
            } else {
                break;
            }
        }
        return total;
    }

    private int cleanupFinishedOlderThanDays(int days, OffsetDateTime now) {
        int total = 0;
        OffsetDateTime cutoffByStart = now.minusDays(days);
        while (true) {
            List<Event> batch = eventRepository
                    .findTop1000ByStatusAndStartsAtBefore(EventStatus.FINISHED, cutoffByStart);
            if (batch.isEmpty()) break;

            List<Event> toDelete = new ArrayList<>();
            for (Event e : batch) {
                if (e.getStartsAt() == null || e.getDurationMin() == null) continue;
                OffsetDateTime end = e.getStartsAt().plusMinutes(e.getDurationMin());
                if (!end.isAfter(now.minusDays(days))) {
                    toDelete.add(e);
                }
            }
            if (!toDelete.isEmpty()) {
                eventRepository.deleteAllInBatch(toDelete);
                total += toDelete.size();
            } else {
                break;
            }
        }
        return total;
    }
}
