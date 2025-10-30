package com.sportlink.user.controller;

import com.sportlink.user.dto.UserCreateRequest;
import com.sportlink.user.dto.UserResponse;
import com.sportlink.user.dto.UserUpdateRequest;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import com.sportlink.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "User", description = "Пользователи")
@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;

    @io.swagger.v3.oas.annotations.Operation(summary = "Регистрация пользователя")
    @PostMapping
    public UserResponse create(@RequestBody @Valid UserCreateRequest req) {
        return userService.create(req);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Публичный профиль по ID")
    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return userService.get(id);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Обновить свой профиль (имя/пароль)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/me")
    public UserResponse updateMe(@RequestBody @Valid UserUpdateRequest req, Authentication auth) {
        // берём текущего пользователя из токена (subject=email)
        String email = auth.getName();
        User me = userRepository.findByEmail(email).orElseThrow();
        return userService.updateMe(me.getId(), req);
    }
}
