package com.sportlink.notification.service;

import java.util.UUID;

public interface NotificationService {
    void userRegistered(UUID userId, String email);
    void applicationSubmitted(UUID eventId, UUID userId);
    void applicationConfirmed(UUID eventId, UUID userId);
}
