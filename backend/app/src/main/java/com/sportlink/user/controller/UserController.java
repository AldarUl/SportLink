package com.sportlink.user.controller;

import com.sportlink.user.dto.UserCreateRequest;
import com.sportlink.user.dto.UserResponse;
import com.sportlink.user.dto.UserUpdateRequest;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import com.sportlink.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;

    @PostMapping
    public UserResponse create(@RequestBody @Valid UserCreateRequest req) {
        return userService.create(req);
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return userService.get(id);
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@RequestBody @Valid UserUpdateRequest req, Authentication auth) {
        // берём текущего пользователя из токена (subject=email)
        String email = auth.getName();
        User me = userRepository.findByEmail(email).orElseThrow();
        return userService.updateMe(me.getId(), req);
    }
}
