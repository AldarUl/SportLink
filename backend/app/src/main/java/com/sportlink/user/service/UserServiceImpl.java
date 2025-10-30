package com.sportlink.user.service;

import com.sportlink.user.dto.UserCreateRequest;
import com.sportlink.user.dto.UserResponse;
import com.sportlink.user.dto.UserUpdateRequest;
import com.sportlink.user.model.Role;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.sportlink.notification.service.NotificationService;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;

    @Override
    public UserResponse create(UserCreateRequest req) {
        userRepository.findByEmail(req.email()).ifPresent(u -> {
            throw new IllegalArgumentException("Email already used");
        });
        var user = User.builder()
                .email(req.email())
                .displayName(req.displayName())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(Role.USER)
                .build();
        user = userRepository.save(user);
        notificationService.userRegistered(user.getId(), user.getEmail());

        return toDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        var u = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toDto(u);
    }

    @Override
    public UserResponse updateMe(UUID currentUserId, UserUpdateRequest req) {
        var u = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.displayName() != null && !req.displayName().isBlank()) {
            u.setDisplayName(req.displayName().trim());
        }

        // смена пароля — только если оба поля заданы и текущий пароль верный
        if (req.newPassword() != null) {
            if (req.currentPassword() == null || !passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect");
            }
            u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        }

        u = userRepository.save(u);
        return toDto(u);
    }

    private UserResponse toDto(User u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getDisplayName());
    }
}
