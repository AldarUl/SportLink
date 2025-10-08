package com.sportlink.auth.service;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;

public interface AuthService {
    LoginResponse login(LoginRequest req);
}
