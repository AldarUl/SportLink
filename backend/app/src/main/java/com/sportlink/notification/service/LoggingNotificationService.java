package com.sportlink.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class LoggingNotificationService implements NotificationService {

    @Override
    public void userRegistered(UUID userId, String email) {
        log.info("[NOTIFY] new user registered id={} email={}", userId, email);
    }

    @Override
    public void eventCreated(UUID eventId, String title, UUID organizerId) {
        log.info("[NOTIFY] event created id={} title='{}' organizer={}", eventId, title, organizerId);
    }

    @Override
    public void applicationSubmitted(UUID eventId, UUID userId) {
        log.info("[NOTIFY] application submitted event={} user={}", eventId, userId);
    }

    @Override
    public void applicationConfirmed(UUID eventId, UUID userId) {
        log.info("[NOTIFY] application CONFIRMED event={} user={}", eventId, userId);
    }

    @Override
    public void applicationDeclined(UUID eventId, UUID userId) {
        log.info("[NOTIFY] application DECLINED event={} user={}", eventId, userId);
    }

    @Override
    public void applicationWithdrawn(UUID eventId, UUID userId) {
        log.info("[NOTIFY] application WITHDRAWN event={} user={}", eventId, userId);
    }
}
