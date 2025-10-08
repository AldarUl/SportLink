package com.sportlink.club.service;

import com.sportlink.club.dto.*;

import java.util.UUID;

public interface ClubService {
    ClubResponse create(String name, UUID ownerId);
    void join(UUID clubId, UUID userId);
    void leave(UUID clubId, UUID userId);
    ClubMemberPage members(UUID clubId, int page, int size);
}
