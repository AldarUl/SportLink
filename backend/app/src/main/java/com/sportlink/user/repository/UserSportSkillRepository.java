package com.sportlink.user.repository;

import com.sportlink.user.model.UserSportSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserSportSkillRepository extends JpaRepository<UserSportSkill, UUID> {
    List<UserSportSkill> findByUserId(UUID userId);
    Optional<UserSportSkill> findByUserIdAndSportIgnoreCase(UUID userId, String sport);
    void deleteByUserIdAndSportIgnoreCase(UUID userId, String sport);
}
