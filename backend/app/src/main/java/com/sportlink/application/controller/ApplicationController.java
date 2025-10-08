package com.sportlink.application.controller;

import com.sportlink.application.dto.ApplicationCreateRequest;
import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;
import com.sportlink.application.service.ApplicationService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/application")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final UserRepository userRepository;

    /* helpers */
    private UUID currentUserId(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow();
        return u.getId();
    }

    /** Подать заявку (тело: eventId; userId проверяем по токену) */
    @PostMapping
    public ApplicationResponse apply(@RequestBody @Valid ApplicationCreateRequest req, Authentication auth) {
        UUID me = currentUserId(auth);
        if (!me.equals(req.userId()))
            throw new IllegalArgumentException("userId must be current user");
        return applicationService.apply(req.eventId(), me);
    }

    /** Список заявок по событию (только организатор) */
    @GetMapping("/by-event/{eventId}")
    public ApplicationPage listByEvent(@PathVariable UUID eventId,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size,
                                       Authentication auth) {
        return applicationService.listByEvent(eventId, page, size, currentUserId(auth));
    }

    /** Мои заявки (по токену) */
    @GetMapping("/my")
    public ApplicationPage my(@RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size,
                              Authentication auth) {
        return applicationService.listMy(currentUserId(auth), page, size);
    }

    /** Отозвать свою заявку */
    @PostMapping("/{applicationId}/withdraw")
    public void withdraw(@PathVariable UUID applicationId, Authentication auth) {
        applicationService.withdraw(applicationId, currentUserId(auth));
    }

    /** Подтвердить заявку (организатор) */
    @PostMapping("/{applicationId}/confirm")
    public ApplicationResponse confirm(@PathVariable UUID applicationId, Authentication auth) {
        return applicationService.confirm(applicationId, currentUserId(auth));
    }

    /** Отклонить заявку (организатор) */
    @PostMapping("/{applicationId}/decline")
    public ApplicationResponse decline(@PathVariable UUID applicationId, Authentication auth) {
        return applicationService.decline(applicationId, currentUserId(auth));
    }
}
