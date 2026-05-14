package com.wolfship.melodia.core.controller;

import com.wolfship.melodia.core.model.dto.BuzzRequest;
import com.wolfship.melodia.core.model.dto.GameStatusResponse;
import com.wolfship.melodia.core.model.dto.GuessRequest;
import com.wolfship.melodia.core.model.dto.GuessResponse;
import com.wolfship.melodia.core.model.dto.StartGameRequest;
import com.wolfship.melodia.core.service.GameService;
import com.wolfship.melodia.external.spotify.SpotifyService;
import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    @PostMapping("/{gameId}/buzz")
    public GameStatusResponse buzz(@PathVariable String gameId, @Valid @RequestBody BuzzRequest request) {
        return gameService.registerBuzz(gameId, request.playerId());
    }

    @PostMapping("/{gameId}/guess")
    public GuessResponse guess(@PathVariable String gameId, @Valid @RequestBody GuessRequest request) {
        return gameService.verifyGuess(gameId, request.playerId(), request.userText());
    }

    @GetMapping("/{gameId}")
    public GameStatusResponse status(@PathVariable String gameId) {
        return gameService.getCurrentStatus(gameId);
    }

    @PostMapping("/{gameId}/next")
    public GameStatusResponse next(@PathVariable String gameId) {
        return gameService.advanceToNextRound(gameId);
    }

    @PostMapping("/{gameId}/skip")
    public GameStatusResponse skip(@PathVariable String gameId) {
        return gameService.skipCurrentTrack(gameId);
    }

    @GetMapping("/playlists/{playlistId}/preview")
    public List<SpotifyTrackDto> previewPlaylist(@PathVariable String playlistId,
                                                 @RequestParam(defaultValue = "10") int count) {
        return spotifyService.getTracks(playlistId, count);
    }
}
