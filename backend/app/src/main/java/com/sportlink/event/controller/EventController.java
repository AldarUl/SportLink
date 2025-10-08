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

    @PostMapping
    public EventResponse create(@RequestBody @Valid EventCreateRequest req, Authentication auth) {
        // Организатор в запросе должен совпадать с текущим пользователем
        UUID me = currentUserId(auth);
        if (!me.equals(req.organizerId())) {
            throw new IllegalArgumentException("OrganizerId must be current user");
        }
        return eventService.create(req);
    }

    @GetMapping("/{id}")
    public EventResponse get(@PathVariable UUID id, org.springframework.security.core.Authentication auth) {
        java.util.UUID viewer = (auth == null) ? null : currentUserId(auth);
        return eventService.get(id, viewer);
    }


    @GetMapping
    public EventPage search(
            @RequestParam(required = false) EventKind kind,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(required = false) EventAccess access,
            @RequestParam(required = false) EventAdmission admission,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return eventService.search(kind, sport, from, to, access, admission, page, size);
    }

    @PatchMapping("/{id}")
    public EventResponse update(@PathVariable UUID id,
                                @RequestBody @Valid EventUpdateRequest req,
                                Authentication auth) {
        return eventService.update(id, currentUserId(auth), req);
    }

    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable UUID id, Authentication auth) {
        eventService.cancel(id, currentUserId(auth));
    }

    @PostMapping("/{id}/publish")
    public void publish(@PathVariable UUID id, Authentication auth) {
        eventService.publish(id, currentUserId(auth));
    }
}
