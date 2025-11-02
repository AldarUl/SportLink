package com.sportlink.user.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
        name = "user_sport_skill",
        uniqueConstraints = @UniqueConstraint(name = "ux_user_sport", columnNames = {"user_id", "sport"})
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserSportSkill {

    @Id @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 64)
    private String sport; // код из справочника

    @Column(nullable = false)
    private short level; // 1..5
}
