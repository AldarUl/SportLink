package com.sportlink.auth.service;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;
import com.sportlink.security.JwtService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import com.sportlink.user.model.User;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final AuthenticationManager authManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    @Override
    public LoginResponse login(LoginRequest req) {
        // Проверка пароля через AuthenticationManager
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.email(), req.password())
        );

        // Загружаем пользователя и выдаём токен
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String token = jwtService.generate(
                user.getEmail(),
                java.util.Map.of("uid", user.getId().toString(), "role", user.getRole().name())
        );
        return new LoginResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }
}
