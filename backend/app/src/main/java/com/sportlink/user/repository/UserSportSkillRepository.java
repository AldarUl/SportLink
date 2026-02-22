package com.sportlink.user.repository;

import com.sportlink.user.model.UserSportSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserSportSkillRepository extends JpaRepository<UserSportSkill, UUID> {
    List<UserSportSkill> findByUserId(UUID userId);
    Optional<UserSportSkill> findByUserIdAndSportIgnoreCase(UUID userId, String sport);

    @Modifying
    @Transactional
    @Query("""
        delete from UserSportSkill s
        where s.user.id = :userId
          and lower(s.sport) = lower(:sport)
    """)
    int deleteByUserIdAndSportIgnoreCase(UUID userId, String sport);
}
