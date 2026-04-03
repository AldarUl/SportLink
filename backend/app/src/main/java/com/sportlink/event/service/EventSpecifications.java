package com.sportlink.event.service;

import com.sportlink.event.model.*;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.Collection;

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

    public static Specification<Event> club(UUID clubId) {
        return clubId == null ? null : (root, q, cb) -> cb.equal(root.get("clubId"), clubId);
    }

    /** Ограничение по статусам (например, для публичной выдачи). */
    public static Specification<Event> statusIn(Collection<EventStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) return null;
        return (root, q, cb) -> root.get("status").in(statuses);
    }

    /** Фильтр по текущему окну карты */
    public static Specification<Event> bbox(Double minLat, Double minLon, Double maxLat, Double maxLon) {
        boolean has = minLat != null && minLon != null && maxLat != null && maxLon != null;
        if (!has) return null;
        return (root, q, cb) -> cb.and(
                cb.isNotNull(root.get("locationLat")),
                cb.isNotNull(root.get("locationLon")),
                cb.between(root.get("locationLat"), minLat, maxLat),
                cb.between(root.get("locationLon"), minLon, maxLon)
        );
    }

    /** Сортировка по близости к центру вьюпорта (манхэттенская метрика + startsAt) */
    public static Specification<Event> orderByDistanceThenStart(Double centerLat, Double centerLon) {
        boolean has = centerLat != null && centerLon != null;
        if (!has) return null;

        return (root, q, cb) -> {
            var dist = cb.sum(
                    cb.abs(cb.diff(root.get("locationLat"), centerLat)),
                    cb.abs(cb.diff(root.get("locationLon"), centerLon))
            );
            q.orderBy(cb.asc(dist), cb.asc(root.get("startsAt")));
            // Возвращаем "true" как нейтральный предикат
            return cb.conjunction();
        };
    }
}
