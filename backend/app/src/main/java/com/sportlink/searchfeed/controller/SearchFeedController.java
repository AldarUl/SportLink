package com.sportlink.searchfeed.controller;

import com.sportlink.event.dto.EventPage;
import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.micrometer.core.annotation.Timed;

import java.time.OffsetDateTime;
import java.util.UUID;

@Tag(name = "Search")
@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchFeedController {

    private final EventService eventService;

    @Operation(summary = "Поиск событий с пагинацией и фильтрами")
    @Timed(value = "event.search", description = "Search events feed")
    @GetMapping
    public EventPage search(
            @RequestParam(required = false) EventKind kind,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(required = false) EventAccess access,
            @RequestParam(required = false) EventAdmission admission,
            @RequestParam(required = false) UUID clubId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return eventService.search(kind, sport, from, to, access, admission, clubId, page, size);
    }
}
