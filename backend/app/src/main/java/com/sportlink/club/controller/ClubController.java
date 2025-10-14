package com.sportlink.club.controller;

import com.sportlink.club.dto.*;
import com.sportlink.club.service.ClubService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Club", description = "Клубы и членство")
@RestController
@RequestMapping("/api/v1/club")
@RequiredArgsConstructor
public class ClubController {

    private final ClubService clubService;
    private final UserRepository userRepository;

    private UUID me(Authentication auth) {
        String email = auth.getName();
        return userRepository.findByEmail(email).orElseThrow().getId();
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Создать клуб")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ClubResponse create(@RequestBody @Valid ClubCreateRequest req, Authentication auth) {
        return clubService.create(req.name(), me(auth));
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Вступить в клуб")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/join")
    public void join(@PathVariable UUID id, Authentication auth) {
        clubService.join(id, me(auth));
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Покинуть клуб")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/leave")
    public void leave(@PathVariable UUID id, Authentication auth) {
        clubService.leave(id, me(auth));
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Список членов клуба (пагинация)")
    @GetMapping("/{id}/member")
    public ClubMemberPage members(@PathVariable UUID id,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        return clubService.members(id, page, size);
    }
}
