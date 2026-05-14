package com.wolfship.melodia.core.controller;

import com.wolfship.melodia.core.model.Player;
import com.wolfship.melodia.core.model.dto.JoinRequest;
import com.wolfship.melodia.core.model.dto.JoinResponse;
import com.wolfship.melodia.core.service.GameService;
import com.wolfship.melodia.shared.security.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Wprowadzone w 0.2.
 * Faza 1: GET /code/{code} → gameId.
 * Faza 2: POST /{code}/join → JWT gracza.
 */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final GameService gameService;
    private final JwtService jwtService;

    @Value("${melodia.jwt.ttl-hours:4}")
    private long ttlHours;

    @GetMapping("/code/{code}")
    public ResponseEntity<Map<String, String>> resolveCode(@PathVariable String code) {
        String gameId = gameService.resolveGameIdByCode(code);
        if (gameId == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "Nie znaleziono pokoju o kodzie: " + code));
        }
        return ResponseEntity.ok(Map.of("gameId", gameId));
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<?> join(@PathVariable String code, @Valid @RequestBody JoinRequest req) {
        String gameId = gameService.resolveGameIdByCode(code);
        if (gameId == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "Nie znaleziono pokoju o kodzie: " + code));
        }
        Player player;
        try {
            player = gameService.addPlayer(gameId, req.name());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
        String token = jwtService.issue(player.getId(), gameId, JwtService.ROLE_PLAYER);
        return ResponseEntity.ok(new JoinResponse(
                token,
                player.getId(),
                gameId,
                code.toUpperCase(),
                player.getHotkey(),
                ttlHours * 3600));
    }
}
