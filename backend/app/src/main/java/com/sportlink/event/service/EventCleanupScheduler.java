package com.sportlink.event.service;

import com.sportlink.event.model.Event;
import com.sportlink.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventCleanupScheduler {

    private final EventRepository eventRepository;

    /**
     * Как часто запускать очистку (CRON).
     * По умолчанию: каждые 5 минут.
     */
    @Value("${sportlink.events.cleanup-cron:0 */5 * * * *}")
    private String cron; // сам CRON используется в аннотации ниже — поле только для конфигов

    /**
     * Сколько дней держим прошедшие события перед удалением.
     * 0 = удалить сразу после окончания.
     */
    @Value("${sportlink.events.retention-days:7}")
    private long retentionDays;

    /** Размер страницы на итерацию. */
    @Value("${sportlink.events.cleanup-batch-size:500}")
    private int batchSize;

    /** Грейс в минутах на «растянутость» занятия (опционально). */
    @Value("${sportlink.events.end-grace-minutes:10}")
    private long endGraceMin;

    @Transactional
    @Scheduled(cron = "${sportlink.events.cleanup-cron:0 */5 * * * *}")
    public void cleanupFinished() {
        final OffsetDateTime now = OffsetDateTime.now();
        final OffsetDateTime cutoff = now.minusDays(retentionDays);
        var pageReq = PageRequest.of(0, batchSize, Sort.by("startsAt").ascending());

        int deleted = 0;
        Page<Event> page;

        do {
            page = eventRepository.findByStartsAtBefore(cutoff, pageReq);
            for (Event e : page.getContent()) {
                // закончилось ли занятие с учётом длительности и «грейса»
                var endedAt = e.getStartsAt().plusMinutes((long) e.getDurationMin() + endGraceMin);
                if (endedAt.isBefore(cutoff)) {
                    eventRepository.delete(e);
                    deleted++;
                }
            }
            pageReq = pageReq.next();
        } while (page.hasNext());

        if (deleted > 0) {
            log.info("[cleanup] deleted {} finished events older than {} days", deleted, retentionDays);
        }
    }
}
