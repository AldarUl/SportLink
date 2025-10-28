package com.sportlink.auth.controller;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;
import com.sportlink.auth.dto.MeResponse;
import com.sportlink.auth.dto.RefreshResponse;
import com.sportlink.auth.service.AuthService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Auth", description = "Аутентификация и текущий пользователь")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    private UUID meId(Authentication auth) {
        return userRepository.findByEmail(auth.getName()).orElseThrow().getId();
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Логин (JWT + refresh в HttpOnly cookie)")
    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest req,
                               HttpServletRequest httpReq,
                               HttpServletResponse httpResp) {
        return authService.login(req, httpReq, httpResp);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Обновить access по refresh (HttpOnly cookie)")
    @PostMapping("/refresh")
    public RefreshResponse refresh(HttpServletRequest httpReq, HttpServletResponse httpResp) {
        return authService.refresh(httpReq, httpResp);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Выход (только с текущего устройства)")
    @PostMapping("/logout")
    public void logout(HttpServletRequest httpReq, HttpServletResponse httpResp,
                       @RequestParam(defaultValue = "false") boolean allDevices) {
        authService.logout(httpReq, httpResp, allDevices);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Текущий пользователь")
    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        User u = userRepository.findByEmail(auth.getName()).orElseThrow();
        return new MeResponse(u.getId(), u.getEmail(), u.getDisplayName()); // <-- без toString()
    }
}
