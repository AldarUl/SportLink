package com.sportlink.auth.service;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;
import com.sportlink.auth.dto.RefreshResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public interface AuthService {
    LoginResponse  login(LoginRequest req, HttpServletRequest httpReq, HttpServletResponse httpResp);
    RefreshResponse refresh(HttpServletRequest httpReq, HttpServletResponse httpResp);
    void logout(HttpServletRequest httpReq, HttpServletResponse httpResp, boolean allDevices);
}
