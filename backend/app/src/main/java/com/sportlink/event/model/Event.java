package com.sportlink.event.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "event", indexes = {
        @Index(name = "ix_event_kind_starts", columnList = "kind, starts_at"),
        @Index(name = "ix_event_sport_starts", columnList = "sport, starts_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Event {
    @Id @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private EventKind kind;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 64)
    private String sport;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "starts_at", nullable = false)
    private OffsetDateTime startsAt;

    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @Column(nullable = false)
    private Integer capacity;

    @Column(name = "waitlist_enabled", nullable = false)
    private boolean waitlistEnabled;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private EventAccess access;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private EventAdmission admission;

    @Column(name = "recurrence_rule", length = 120)
    private String recurrenceRule;

    @Column(name = "registration_deadline")
    private OffsetDateTime registrationDeadline;

    @Column(name = "organizer_id", columnDefinition = "uuid", nullable = false)
    private UUID organizerId;

    @Column(name = "club_id", columnDefinition = "uuid")
    private UUID clubId;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private EventStatus status;

    @Column(name = "location_lat") private Double locationLat;
    @Column(name = "location_lon") private Double locationLon;

    @CreationTimestamp private Instant createdAt;
    @UpdateTimestamp private Instant updatedAt;
}
