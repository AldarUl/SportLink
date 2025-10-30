package com.sportlink.user.service;

import com.sportlink.user.dto.UserCreateRequest;
import com.sportlink.user.dto.UserResponse;
import com.sportlink.user.dto.UserUpdateRequest;

import java.util.UUID;

public interface UserService {
    UserResponse create(UserCreateRequest req);
    UserResponse get(UUID id);
    UserResponse updateMe(UUID currentUserId, UserUpdateRequest req);
}
