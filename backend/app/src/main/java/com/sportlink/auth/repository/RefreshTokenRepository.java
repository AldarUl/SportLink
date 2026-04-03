package com.sportlink.auth.repository;

import com.sportlink.auth.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHashAndRevokedAtIsNull(String tokenHash);
    long deleteByFamilyId(UUID familyId);

    long deleteByUserId(UUID userId);
}
