package com.sportlink.application.controller;

import com.sportlink.application.dto.ApplicationCreateRequest;
import com.sportlink.application.dto.ApplicationPage;
import com.sportlink.application.dto.ApplicationResponse;
import com.sportlink.application.service.ApplicationService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Application", description = "Заявки на участие")
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

    /** Подать заявку (в теле только eventId; userId берём из токена) */
    @io.swagger.v3.oas.annotations.Operation(summary = "Подать заявку")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ApplicationResponse apply(@RequestBody @Valid ApplicationCreateRequest req, Authentication auth) {
        UUID me = currentUserId(auth);
        return applicationService.apply(req.eventId(), me);
    }

    /** Заявки по событию (только организатор) */
    @io.swagger.v3.oas.annotations.Operation(summary = "Заявки по событию (организатор)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    // @PreAuthorize("hasRole('ORGANIZER') or hasRole('ADMIN')") // опционально, если включена методовая безопасность
    @GetMapping("/by-event/{eventId}")
    public ApplicationPage listByEvent(@PathVariable UUID eventId,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size,
                                       Authentication auth) {
        return applicationService.listByEvent(eventId, page, Math.min(Math.max(size, 1), 100), currentUserId(auth));
    }

    /** Мои заявки (по токену) */
    @io.swagger.v3.oas.annotations.Operation(summary = "Мои заявки")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @GetMapping("/my")
    public ApplicationPage my(@RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size,
                              Authentication auth) {
        return applicationService.listMy(currentUserId(auth), page, Math.min(Math.max(size, 1), 100));
    }

    /** Отозвать свою заявку */
    @io.swagger.v3.oas.annotations.Operation(summary = "Отозвать свою заявку")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{applicationId}/withdraw")
    public void withdraw(@PathVariable UUID applicationId, Authentication auth) {
        applicationService.withdraw(applicationId, currentUserId(auth));
    }

    /** Подтвердить заявку (организатор) */
    @io.swagger.v3.oas.annotations.Operation(summary = "Подтвердить заявку (организатор)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    // @PreAuthorize("hasRole('ORGANIZER') or hasRole('ADMIN')")
    @PostMapping("/{applicationId}/confirm")
    public ApplicationResponse confirm(@PathVariable UUID applicationId, Authentication auth) {
        return applicationService.confirm(applicationId, currentUserId(auth));
    }

    /** Отклонить заявку (организатор) */
    @io.swagger.v3.oas.annotations.Operation(summary = "Отклонить заявку (организатор)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    // @PreAuthorize("hasRole('ORGANIZER') or hasRole('ADMIN')")
    @PostMapping("/{applicationId}/decline")
    public ApplicationResponse decline(@PathVariable UUID applicationId, Authentication auth) {
        return applicationService.decline(applicationId, currentUserId(auth));
    }
}
