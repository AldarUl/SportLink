package com.sportlink.club.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "club_member",
        uniqueConstraints = @UniqueConstraint(name = "ux_club_member", columnNames = {"club_id","user_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClubMember {
    @Id @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "club_id", columnDefinition = "uuid", nullable = false)
    private UUID clubId;

    @Column(name = "user_id", columnDefinition = "uuid", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ClubMemberRole role;

    @CreationTimestamp
    private Instant createdAt;
}
