package com.sportlink.user.controller;

import com.sportlink.user.dto.UserCard;
import com.sportlink.user.repository.UserSearchRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.web.bind.annotation.*;

@Tag(name = "User", description = "Пользователи")
@RestController
@RequestMapping("/api/v1/users") // ПЛЮРАЛЬНО для поиска
@RequiredArgsConstructor
public class UserSearchController {

    private final UserSearchRepository repo;

    @Operation(summary = "Публичный поиск пользователей (пагинация/фильтры)")
    @GetMapping
    public Page<UserCard> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) Integer lvlMin,
            @RequestParam(required = false) Integer lvlMax,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        return repo.search((q == null || q.isBlank()) ? null : q.trim(),
                (sport == null || sport.isBlank()) ? null : sport.trim(),
                lvlMin, lvlMax, pageable);
    }
}
