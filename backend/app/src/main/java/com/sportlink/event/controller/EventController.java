package com.sportlink.event.controller;

import com.sportlink.event.dto.EventCreateRequest;
import com.sportlink.event.dto.EventPage;
import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.dto.EventUpdateRequest;
import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.service.EventService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Event", description = "События и тренировки")
@RestController
@RequestMapping("/api/v1/event")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final UserRepository userRepository;

    /* helpers */
    private UUID currentUserId(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow();
        return u.getId();
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Создать событие/тренировку")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public EventResponse create(@RequestBody @Valid EventCreateRequest req, Authentication auth) {
        // Организатор в запросе должен совпадать с текущим пользователем
        UUID me = currentUserId(auth);
        if (!me.equals(req.organizerId())) {
            throw new IllegalArgumentException("OrganizerId must be current user");
        }
        return eventService.create(req);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Детали события")
    @GetMapping("/{id}")
    public EventResponse get(@PathVariable UUID id, org.springframework.security.core.Authentication auth) {
        java.util.UUID viewer = (auth == null) ? null : currentUserId(auth);
        return eventService.get(id, viewer);
    }


    @io.swagger.v3.oas.annotations.Operation(summary = "Поиск событий (пагинация и фильтры)")
    @GetMapping
    public EventPage search(
            @RequestParam(required = false) EventKind kind,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(required = false) EventAccess access,
            @RequestParam(required = false) EventAdmission admission,
            @RequestParam(required = false) java.util.UUID clubId,   // ← добавили
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return eventService.search(kind, sport, from, to, access, admission, clubId, page, size);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Изменить событие")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/{id}")
    public EventResponse update(@PathVariable UUID id,
                                @RequestBody @Valid EventUpdateRequest req,
                                Authentication auth) {
        return eventService.update(id, currentUserId(auth), req);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Отменить событие")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable UUID id, Authentication auth) {
        eventService.cancel(id, currentUserId(auth));
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Опубликовать событие")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/publish")
    public void publish(@PathVariable UUID id, Authentication auth) {
        eventService.publish(id, currentUserId(auth));
    }
}
