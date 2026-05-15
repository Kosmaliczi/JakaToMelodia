package com.wolfship.melodia.core.controller;

import com.wolfship.melodia.core.model.dto.BuzzRequest;
import com.wolfship.melodia.core.model.dto.CreateLobbyRequest;
import com.wolfship.melodia.core.model.dto.GameStatusResponse;
import com.wolfship.melodia.core.model.dto.GuessRequest;
import com.wolfship.melodia.core.model.dto.GuessResponse;
import com.wolfship.melodia.core.model.dto.StartGameRequest;
import com.wolfship.melodia.core.service.GameService;
import com.wolfship.melodia.external.spotify.SpotifyService;
import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import com.wolfship.melodia.shared.security.JwtService;
import com.wolfship.melodia.shared.security.PlayerPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;
    private final SpotifyService spotifyService;

    @PostMapping("/start")
    public ResponseEntity<GameStatusResponse> start(@Valid @RequestBody StartGameRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gameService.initializeGame(request));
    }

    @PostMapping("/lobby")
    public ResponseEntity<GameStatusResponse> createLobby(@Valid @RequestBody CreateLobbyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gameService.initializeLobby(request));
    }

    @PostMapping("/{gameId}/start")
    public GameStatusResponse startWaiting(@PathVariable String gameId) {
        requireHost(gameId);
        return gameService.startWaitingGame(gameId);
    }

    @PostMapping("/{gameId}/ready")
    public GameStatusResponse setReady(@PathVariable String gameId, @RequestBody ReadyRequest body) {
        PlayerPrincipal principal = currentPrincipal();
        if (principal == null || !JwtService.ROLE_PLAYER.equalsIgnoreCase(principal.role())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Tylko dołączeni gracze mogą ustawiać status gotowości");
        }
        if (!gameId.equals(principal.gameId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Token nie pasuje do tego pokoju");
        }
        return gameService.setPlayerReady(gameId, principal.playerId(), body.ready());
    }

    public record ReadyRequest(boolean ready) {}

    @PostMapping("/{gameId}/buzz")
    public GameStatusResponse buzz(@PathVariable String gameId, @Valid @RequestBody BuzzRequest request) {
        String playerId = resolveActingPlayerId(gameId, request.playerId());
        return gameService.registerBuzz(gameId, playerId);
    }

    @PostMapping("/{gameId}/guess")
    public GuessResponse guess(@PathVariable String gameId, @Valid @RequestBody GuessRequest request) {
        String playerId = resolveActingPlayerId(gameId, request.playerId());
        return gameService.verifyGuess(gameId, playerId, request.userText());
    }

    @GetMapping("/{gameId}")
    public GameStatusResponse status(@PathVariable String gameId) {
        return gameService.getCurrentStatus(gameId);
    }

    @PostMapping("/{gameId}/next")
    public GameStatusResponse next(@PathVariable String gameId) {
        requireHost(gameId);
        return gameService.advanceToNextRound(gameId);
    }

    @PostMapping("/{gameId}/skip")
    public GameStatusResponse skip(@PathVariable String gameId) {
        requireHost(gameId);
        return gameService.skipCurrentTrack(gameId);
    }

    @GetMapping("/playlists/{playlistId}/preview")
    public List<SpotifyTrackDto> previewPlaylist(@PathVariable String playlistId,
                                                 @RequestParam(defaultValue = "10") int count) {
        return spotifyService.getTracks(playlistId, count);
    }

    /**
     * Wybiera kogo reprezentuje request:
     * - jeśli jest PlayerPrincipal (JWT) → wymusza playerId z tokenu i sprawdza gameId
     * - inaczej (host na pojedynczym urządzeniu) → akceptuje playerId z body
     */
    private String resolveActingPlayerId(String pathGameId, String bodyPlayerId) {
        PlayerPrincipal principal = currentPrincipal();
        if (principal != null && JwtService.ROLE_PLAYER.equalsIgnoreCase(principal.role())) {
            if (!pathGameId.equals(principal.gameId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Token nie pasuje do tego pokoju");
            }
            return principal.playerId();
        }
        return bodyPlayerId;
    }

    private void requireHost(String pathGameId) {
        // Brak PlayerPrincipal w kontekście = OAuth2 session hosta (lub anonim
        // który i tak nic nie zdziała). Bearer wygrywa nad cookie w filtrze,
        // więc jawne "udawanie playera" bezpiecznie eskaluje do 403.
        PlayerPrincipal principal = currentPrincipal();
        if (principal == null) return;
        if (JwtService.ROLE_HOST.equalsIgnoreCase(principal.role())
                && pathGameId.equals(principal.gameId())) return;
        log.warn("requireHost: 403 dla pathGameId={}, principal.role={}, principal.gameId={}, principal.playerId={}. " +
                        "Najczęstsza przyczyna: stary PLAYER token w sessionStorage karty hosta. " +
                        "Wyczyść sessionStorage karty hosta lub upewnij się, że host nie wykonywał /join w tej samej karcie.",
                pathGameId, principal.role(), principal.gameId(), principal.playerId());
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Tylko host może wykonywać tę akcję");
    }

    private PlayerPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof PlayerPrincipal pp) return pp;
        return null;
    }
}
