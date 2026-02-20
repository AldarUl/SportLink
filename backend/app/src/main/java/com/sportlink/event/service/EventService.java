package com.sportlink.event.service;

import com.sportlink.event.model.EventAccess;
import com.sportlink.event.model.EventAdmission;
import com.sportlink.event.model.EventKind;
import com.sportlink.event.dto.EventCreateRequest;
import com.sportlink.event.dto.EventResponse;
import com.sportlink.event.dto.EventUpdateRequest;
import com.sportlink.event.dto.EventPage;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface EventService {
    EventResponse create(EventCreateRequest req, UUID organizerId);

    EventResponse get(UUID id, UUID viewerId);
    default EventResponse get(UUID id) { return get(id, null); }

    EventPage search(
            EventKind kind, String sport,
            OffsetDateTime from, OffsetDateTime to,
            EventAccess access, EventAdmission admission,
            java.util.UUID clubId,
            Double minLat, Double minLon, Double maxLat, Double maxLon,
            Double centerLat, Double centerLon,
            int page, int size
    );

    EventResponse update(UUID id, UUID currentUserId, EventUpdateRequest update);
    void cancel(UUID id, UUID currentUserId);
    void publish(UUID id, UUID currentUserId);

    boolean hasFreeCapacity(UUID eventId);

    void delete(UUID id, UUID currentUserId);

    EventPage my(UUID organizerId, boolean futureOnly, int page, int size);

    EventResponse launch(UUID id, UUID currentUserId);

    // Manual finish endpoint (used by UI)
    EventResponse finish(UUID id, UUID currentUserId);
}
