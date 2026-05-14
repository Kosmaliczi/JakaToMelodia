package com.wolfship.melodia.shared.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.MacAlgorithm;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

/**
 * Wystawia i weryfikuje JWT graczy (0.2 Faza 2).
 * HS256, secret z `melodia.jwt.secret` (env var w prod, fallback dev).
 * TTL 4h pokrywa nawet najdłuższą grę; gracz po wygaśnięciu powtarza /join.
 */
@Slf4j
@Service
public class JwtService {

    public static final String CLAIM_GAME_ID = "gameId";
    public static final String CLAIM_ROLE = "role";
    public static final String ROLE_PLAYER = "PLAYER";
    public static final String ROLE_HOST = "HOST";

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${melodia.jwt.secret:}") String configuredSecret,
                      @Value("${melodia.jwt.ttl-hours:4}") long ttlHours) {
        this.ttl = Duration.ofHours(ttlHours);
        this.key = resolveKey(configuredSecret);
    }

    public String issue(String playerId, String gameId, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(playerId)
                .claim(CLAIM_GAME_ID, gameId)
                .claim(CLAIM_ROLE, role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Claims verify(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey resolveKey(String configuredSecret) {
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            try {
                byte[] decoded = Decoders.BASE64.decode(configuredSecret);
                if (decoded.length >= 32) {
                    return Keys.hmacShaKeyFor(decoded);
                }
            } catch (IllegalArgumentException ignored) {
                // sekret nie jest base64 - użyj jako raw bytes
            }
            byte[] raw = configuredSecret.getBytes(StandardCharsets.UTF_8);
            if (raw.length >= 32) {
                return Keys.hmacShaKeyFor(raw);
            }
            return Keys.hmacShaKeyFor(stretch(raw));
        }
        log.warn("melodia.jwt.secret nie jest ustawiony — używam ulotnego sekretu deweloperskiego. " +
                "USTAW go w produkcji (32+ bajty)!");
        // Sekret deweloperski - generowany przy starcie procesu. Restart = unieważnienie wszystkich tokenów.
        MacAlgorithm alg = Jwts.SIG.HS256;
        return alg.key().build();
    }

    private byte[] stretch(byte[] raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(raw);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
