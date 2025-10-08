package com.sportlink.searchfeed.controller;

import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchFeedController {

    private final EventService eventService;

    @GetMapping
    public List<EventResponse> search(
            @RequestParam(required = false) EventKind kind,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to
    ) {
        // пока без БД-фильтров: берём список и фильтруем в памяти
        return eventService.list(kind).stream()
                .filter(e -> sport == null || e.sport().equalsIgnoreCase(sport))
                .filter(e -> from == null || !e.startsAt().isBefore(from))
                .filter(e -> to == null || !e.startsAt().isAfter(to))
                .toList();
    }
}
