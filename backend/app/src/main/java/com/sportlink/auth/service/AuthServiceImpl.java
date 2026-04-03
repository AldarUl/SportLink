package com.sportlink.auth.service;

import com.sportlink.auth.dto.LoginRequest;
import com.sportlink.auth.dto.LoginResponse;
import com.sportlink.auth.dto.RefreshResponse;
import com.sportlink.auth.model.RefreshToken;
import com.sportlink.auth.repository.RefreshTokenRepository;
import com.sportlink.common.exception.UnauthorizedException;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshRepo;
    private final JwtService jwt;
    private final PasswordEncoder passwordEncoder;

    @Value("${security.jwt.refreshTtlDays:30}")
    long refreshTtlDays;

    @Value("${security.refreshCookie.name:refreshToken}")
    String refreshCookieName;

    @Value("${security.refreshCookie.path:/api/v1/auth/refresh}")
    String refreshCookiePath;

    @Value("${security.refreshCookie.sameSite:Strict}")
    String sameSite;

    @Value("${security.refreshCookie.secure:true}")
    boolean secure;

    private static final SecureRandom RNG = new SecureRandom();

    @Override
    public LoginResponse login(LoginRequest req, HttpServletRequest httpReq, HttpServletResponse httpResp) {
        // 1) Проверяем, что пользователь существует, пароль верный и аккаунт не заблокирован
        User user = userRepository.findByEmailIgnoreCase(req.email())
                .orElseThrow(() -> new UnauthorizedException("BAD_CREDENTIALS"));

        if (user.isBlocked()) {
            throw new UnauthorizedException("ACCOUNT_BLOCKED");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("BAD_CREDENTIALS");
        }

        // 2) Access JWT: subject = email (важно для твоего JwtAuthFilter)
        String access = jwt.createAccessJwt(
                user.getEmail(), // subject
                Map.of(
                        "uid",  user.getId().toString(),
                        "role", String.valueOf(user.getRole()) // enum → String
                )
        );

        // 3) Refresh: создать «семейство» + первый токен
        String rawRefresh = generateRandomToken();
        String tokenHash  = sha256(rawRefresh);
        UUID familyId     = UUID.randomUUID();

        RefreshToken rt = new RefreshToken(
                UUID.randomUUID(),
                user.getId(),
                tokenHash,
                familyId,
                Instant.now(),
                Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS),
                null,
                null,
                httpReq.getHeader("User-Agent"),
                clientIp(httpReq)
        );
        refreshRepo.save(rt);

        setRefreshCookie(httpResp, rawRefresh, (int) (refreshTtlDays * 24 * 3600));

        // 4) Соберём displayName (у тебя поле not null, но сделаем фолбэк на всякий)
        String displayName = (user.getDisplayName() != null && !user.getDisplayName().isBlank())
                ? user.getDisplayName()
                : user.getEmail();

        // 5) Вернуть ВСЕ 5 полей LoginResponse
        return new LoginResponse(
                access,                       // accessToken
                jwt.getAccessTtlSeconds(),    // expiresIn (sec)
                user.getId(),                 // userId
                user.getEmail(),              // email
                displayName                   // displayName
        );
    }


    @Override
    public RefreshResponse refresh(HttpServletRequest httpReq, HttpServletResponse httpResp) {
        String raw = readRefreshCookie(httpReq).orElseThrow(() -> new UnauthorizedException("No refresh cookie"));
        String hash = sha256(raw);

        RefreshToken current = refreshRepo.findByTokenHashAndRevokedAtIsNull(hash)
                .orElseThrow(() -> new UnauthorizedException("Refresh not found or revoked"));

        if (current.getExpiresAt().isBefore(Instant.now())) {
            // Срок вышел: блокируем семейство и ошибка
            refreshRepo.deleteByFamilyId(current.getFamilyId());
            throw new UnauthorizedException("Refresh expired");
        }

        // Ротация: создаём новый refresh, старый помечаем replaced_by + revoked_at
        String newRaw = generateRandomToken();
        RefreshToken next = new RefreshToken(
                UUID.randomUUID(),
                current.getUserId(),
                sha256(newRaw),
                current.getFamilyId(),
                Instant.now(),
                Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS),
                null,
                null,
                httpReq.getHeader("User-Agent"),
                clientIp(httpReq)
        );
        refreshRepo.save(next);

        current.setReplacedBy(next.getId());
        current.setRevokedAt(Instant.now());
        refreshRepo.save(current);

        // Access
        // ВАЖНО: subject в access JWT должен быть email (см. JwtAuthFilter + UserDetailsServiceImpl),
        // иначе после refresh все защищённые эндпоинты будут видеть пользователя как anonymous -> 403.
// стало
        User user = userRepository.findById(current.getUserId())
                .orElseThrow(() -> new UnauthorizedException("User not found"));
        if (user.isBlocked()) {
            // На всякий случай чистим семейство и не выдаём новые токены.
            refreshRepo.deleteByFamilyId(current.getFamilyId());
            throw new UnauthorizedException("ACCOUNT_BLOCKED");
        }
        String access = jwt.createAccessJwt(user.getEmail(), Map.of(
                "uid", user.getId().toString(),
                "role", user.getRole().name()
        ));
        setRefreshCookie(httpResp, newRaw, (int) (refreshTtlDays * 24 * 3600));

        return new RefreshResponse(access, jwt.getAccessTtlSeconds());
    }

    @Override
    public void logout(HttpServletRequest httpReq, HttpServletResponse httpResp, boolean allDevices) {
        readRefreshCookie(httpReq).ifPresent(raw -> {
            String hash = sha256(raw);
            refreshRepo.findByTokenHashAndRevokedAtIsNull(hash).ifPresent(rt -> {
                if (allDevices) {
                    refreshRepo.deleteByFamilyId(rt.getFamilyId());
                } else {
                    rt.setRevokedAt(Instant.now());
                    refreshRepo.save(rt);
                }
            });
        });
        // Сброс куки
        setRefreshCookie(httpResp, "", 0);
    }

    // --- helpers ---

    private void setRefreshCookie(HttpServletResponse resp, String value, int maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(refreshCookieName, value)
                .httpOnly(true)
                .secure(secure)
                .path(refreshCookiePath)
                .sameSite(sameSite)
                .maxAge(maxAgeSeconds)
                .build();
        resp.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private Optional<String> readRefreshCookie(HttpServletRequest req) {
        if (req.getCookies() == null) return Optional.empty();
        for (Cookie c : req.getCookies()) {
            if (refreshCookieName.equals(c.getName())) return Optional.ofNullable(c.getValue());
        }
        return Optional.empty();
    }

    private static String clientIp(HttpServletRequest req) {
        String h = req.getHeader("X-Forwarded-For");
        return (h != null && !h.isBlank()) ? h.split(",")[0].trim() : req.getRemoteAddr();
    }

    private static String generateRandomToken() {
        byte[] b = new byte[32];
        RNG.nextBytes(b);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
