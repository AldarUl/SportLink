package com.sportlink.review.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review",
        uniqueConstraints = @UniqueConstraint(name="ux_review_event_author", columnNames={"event_id","author_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Review {
    @Id @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "event_id", columnDefinition = "uuid", nullable = false)
    private UUID eventId;

    @Column(name = "author_id", columnDefinition = "uuid", nullable = false)
    private UUID authorId;

    @Column(nullable = false)
    private int rating;                  // 1..5

    @Column(columnDefinition = "text")
    private String comment;

    @CreationTimestamp
    private Instant createdAt;
}
