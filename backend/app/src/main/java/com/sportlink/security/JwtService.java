package com.sportlink.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;

@Service
public class JwtService {
    private final Algorithm algorithm;
    private final long expirationMs;

    public JwtService(JwtProperties props) {
        this.algorithm = Algorithm.HMAC256(props.secret());
        this.expirationMs = props.expirationMs();
    }

    public String generate(String subject, Map<String, String> claims) {
        var now = new Date();
        var exp = new Date(now.getTime() + expirationMs);
        var builder = JWT.create()
                .withSubject(subject)
                .withIssuedAt(now)
                .withExpiresAt(exp);
        claims.forEach(builder::withClaim);
        return builder.sign(algorithm);
    }

    public DecodedJWT validate(String token) {
        return JWT.require(algorithm).build().verify(token);
    }

    public String extractSubject(String token) {
        return validate(token).getSubject();
    }
}
