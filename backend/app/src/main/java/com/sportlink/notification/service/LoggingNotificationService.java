package com.sportlink.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class LoggingNotificationService implements NotificationService {

    @Override
    public void userRegistered(UUID userId, String email) {
        log.info("Notify: new user registered id={} email={}", userId, email);
    }

    @Override
    public void applicationSubmitted(UUID eventId, UUID userId) {
        log.info("Notify: application submitted event={} user={}", eventId, userId);
    }

    @Override
    public void applicationConfirmed(UUID eventId, UUID userId) {
        log.info("Notify: application CONFIRMED event={} user={}", eventId, userId);
    }
}
