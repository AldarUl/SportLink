package com.sportlink.user.controller;

import com.sportlink.user.dto.UserCreateRequest;
import com.sportlink.user.dto.UserResponse;
import com.sportlink.user.dto.UserSkillResponse;
import com.sportlink.user.dto.UserUpdateRequest;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import com.sportlink.user.repository.UserSportSkillRepository;
import com.sportlink.user.service.AvatarService;
import com.sportlink.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "User", description = "Пользователи")
@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;
    private final UserSportSkillRepository userSportSkillRepository;
    private final AvatarService avatarService;

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

    // дополним UserController
    @GetMapping("/{id}/skills")
    public List<UserSkillResponse> skillsByUser(@PathVariable UUID id) {
        return userSportSkillRepository.findByUserId(id).stream()
                .map(s -> new UserSkillResponse(s.getSport(), s.getLevel(), null))
                .toList();
    }

    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping(value = "/me/avatar", consumes = "multipart/form-data")
    public UserResponse uploadAvatar(@RequestPart("file") MultipartFile file, Authentication auth) throws Exception {
        UUID meId = userRepository.findByEmail(auth.getName()).orElseThrow().getId();
        var u = userRepository.findById(meId).orElseThrow();

        avatarService.deleteAll(meId);
        avatarService.store(meId, file);

        u.setAvatarUrl(avatarService.link(meId)); // 👉 ссылка с версией
        userRepository.save(u);

        return userService.get(meId);
    }

    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/me/avatar")
    public void deleteAvatar(Authentication auth) throws Exception {
        UUID meId = userRepository.findByEmail(auth.getName()).orElseThrow().getId();
        var u = userRepository.findById(meId).orElseThrow();
        avatarService.deleteAll(meId);
        u.setAvatarUrl(null);
        userRepository.save(u);
    }
}
