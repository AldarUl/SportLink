package com.sportlink.application.service;

import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;

import java.util.UUID;

public interface ApplicationService {

    ApplicationResponse apply(UUID eventId, UUID userId);     // подать заявку

    ApplicationResponse confirm(UUID applicationId, UUID organizerId); // организатор подтверждает
    ApplicationResponse decline(UUID applicationId, UUID organizerId); // организатор отклоняет

    ApplicationPage listByEvent(UUID eventId, int page, int size, UUID organizerId); // заявки конкретного события (только организатор)
    ApplicationPage listMy(UUID userId, int page, int size);                           // мои заявки

    void withdraw(UUID applicationId, UUID userId);            // пользователь отзывает свою заявку
}
