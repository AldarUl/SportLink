package com.sportlink.auth.controller;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;
import com.sportlink.auth.dto.MeResponse;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import com.sportlink.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Auth", description = "Аутентификация и текущий пользователь")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final UserRepository userRepository;

    @io.swagger.v3.oas.annotations.Operation(summary = "Логин (JWT)")
    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest req) {
        return authService.login(req);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Текущий пользователь")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        // subject = email из токена
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow();
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName());
    }
}
