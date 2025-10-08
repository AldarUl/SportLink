package com.sportlink.event.service;

import com.sportlink.event.model.*;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;

public final class EventSpecifications {
    private EventSpecifications(){}

    public static Specification<Event> kind(EventKind kind) {
        return kind == null ? null : (root, q, cb) -> cb.equal(root.get("kind"), kind);
    }
    public static Specification<Event> sport(String sport) {
        return (sport == null || sport.isBlank()) ? null
                : (root, q, cb) -> cb.equal(cb.lower(root.get("sport")), sport.toLowerCase());
    }
    public static Specification<Event> access(EventAccess access) {
        return access == null ? null : (root, q, cb) -> cb.equal(root.get("access"), access);
    }
    public static Specification<Event> admission(EventAdmission admission) {
        return admission == null ? null : (root, q, cb) -> cb.equal(root.get("admission"), admission);
    }
    public static Specification<Event> startsFrom(OffsetDateTime from) {
        return from == null ? null : (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("startsAt"), from);
    }
    public static Specification<Event> startsTo(OffsetDateTime to) {
        return to == null ? null : (root, q, cb) -> cb.lessThanOrEqualTo(root.get("startsAt"), to);
    }
}
