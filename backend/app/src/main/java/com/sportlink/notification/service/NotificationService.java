package com.sportlink.notification.service;

import java.util.UUID;

public interface NotificationService {
    // user
    void userRegistered(UUID userId, String email);

    // event
    void eventCreated(UUID eventId, String title, UUID organizerId);

    // applications
    void applicationSubmitted(UUID eventId, UUID userId);
    void applicationConfirmed(UUID eventId, UUID userId);
    void applicationDeclined(UUID eventId, UUID userId);
    void applicationWithdrawn(UUID eventId, UUID userId);
}
