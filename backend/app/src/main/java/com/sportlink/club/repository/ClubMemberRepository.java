package com.sportlink.club.repository;

import com.sportlink.club.model.ClubMember;
import com.sportlink.club.model.ClubMemberRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ClubMemberRepository extends JpaRepository<ClubMember, UUID> {
    boolean existsByClubIdAndUserId(UUID clubId, UUID userId);
    Optional<ClubMember> findByClubIdAndUserId(UUID clubId, UUID userId);
    Page<ClubMember> findByClubId(UUID clubId, Pageable pageable);
    long countByClubIdAndRole(UUID clubId, ClubMemberRole role);
}
