package com.sportlink.auth.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_token")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RefreshToken {

    @Id
    @Column(columnDefinition = "uuid")
    UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    String tokenHash;

    @Column(name = "family_id", nullable = false, columnDefinition = "uuid")
    UUID familyId;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    Instant expiresAt;

    @Column(name = "replaced_by", columnDefinition = "uuid")
    UUID replacedBy;

    @Column(name = "revoked_at")
    Instant revokedAt;

    @Column(name = "user_agent")
    String userAgent;

    @Column(name = "ip", length = 45)
    String ip;
}
