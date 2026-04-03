package com.sportlink.config;

import com.sportlink.user.model.Role;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Создаёт (или обновляет) bootstrap-админа при старте приложения.
 *
 * Правила:
 *  - если app.bootstrap-admin.enabled=false -> ничего не делаем
 *  - если email/password не заданы -> ничего не делаем
 *  - если в системе уже есть админ (роль ADMIN) -> ничего не делаем
 *  - если пользователь с email существует -> делаем его ADMIN и обновляем пароль
 *  - иначе создаём нового пользователя ADMIN
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BootstrapAdminRunner implements ApplicationRunner {

    private final BootstrapAdminProperties props;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        if (!props.isEnabled()) return;

        String email = (props.getEmail() == null) ? null : props.getEmail().trim().toLowerCase();
        String password = (props.getPassword() == null) ? null : props.getPassword().trim();
        if (email == null || email.isBlank() || password == null || password.isBlank()) return;

        // Если уже есть админ — не создаём второго автоматически.
        if (userRepository.existsByRole(Role.ADMIN)) return;

        String displayName = (props.getDisplayName() == null || props.getDisplayName().isBlank())
                ? "Admin"
                : props.getDisplayName().trim();

        userRepository.findByEmailIgnoreCase(email)
                .ifPresentOrElse(existing -> {
                    existing.setRole(Role.ADMIN);
                    existing.setBlocked(false);
                    existing.setDisplayName(displayName);
                    existing.setPasswordHash(passwordEncoder.encode(password));
                    userRepository.save(existing);
                    log.info("Bootstrap admin: promoted existing user {} to ADMIN", email);
                }, () -> {
                    User admin = User.builder()
                            .email(email)
                            .displayName(displayName)
                            .passwordHash(passwordEncoder.encode(password))
                            .role(Role.ADMIN)
                            .blocked(false)
                            .build();
                    userRepository.save(admin);
                    log.info("Bootstrap admin: created new admin {}", email);
                });
    }
}
