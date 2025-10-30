package com.sportlink.auth.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final byte[] key;
    private final String issuer;
    private final long accessTtlMinutes;

    public JwtService(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.issuer:sportlink}") String issuer,
            @Value("${security.jwt.accessTtlMinutes:15}") long accessTtlMinutes
    ) {
        // Важно: secret должен быть достаточно длинный (минимум 32 байта для HS256)
        this.key = secret.getBytes(StandardCharsets.UTF_8);
        this.issuer = issuer;
        this.accessTtlMinutes = accessTtlMinutes;
    }

    public String createAccessJwt(String subject, Map<String, Object> claims) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(accessTtlMinutes * 60);
        return Jwts.builder()
                .issuer(issuer)
                .subject(subject)
                .claims(claims)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(Keys.hmacShaKeyFor(key)) // 0.12.x сам подберёт HS-алгоритм по ключу
                .compact();
    }

    /** Нужен твоему JwtAuthFilter: достаём subject (у нас это email) */
    public String extractSubject(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(key))
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public long getAccessTtlSeconds() {
        return accessTtlMinutes * 60;
    }
}
