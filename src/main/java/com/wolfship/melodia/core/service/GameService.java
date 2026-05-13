package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GameSession;
import com.wolfship.melodia.core.model.GuessResult;
import com.wolfship.melodia.core.model.Player;
import com.wolfship.melodia.core.model.dto.GameStatusResponse;
import com.wolfship.melodia.core.model.dto.GameStatusResponse.TrackReveal;
import com.wolfship.melodia.core.model.dto.GuessResponse;
import com.wolfship.melodia.core.model.dto.StartGameRequest;
import com.wolfship.melodia.external.spotify.SpotifyService;
import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class GameService {

    private static final String[] DEFAULT_HOTKEYS = {"Q", "P", "Z", "M"};

    private final SpotifyService spotifyService;
    private final AnswerValidator answerValidator;
    private final ScoreEngine scoreEngine;
    private final GameEventPublisher eventPublisher;

    private final Map<String, GameSession> activeSessions = new ConcurrentHashMap<>();

    public GameStatusResponse initializeGame(StartGameRequest request) {
        if (request.playerNames() == null || request.playerNames().size() < 2 || request.playerNames().size() > 4) {
            throw new IllegalArgumentException("Liczba graczy musi być w zakresie 2-4");
        }
        if (request.totalRounds() <= 0) {
            throw new IllegalArgumentException("Liczba rund musi być dodatnia");
        }

        List<SpotifyTrackDto> tracks = spotifyService.getTracks(request.playlistId(), request.totalRounds());
        if (tracks.isEmpty()) {
            throw new IllegalStateException("Brak grywalnych utworów w wybranej playliście");
        }

        String gameId = UUID.randomUUID().toString();
        GameSession session = new GameSession();
        session.setGameId(gameId);
        session.setStatus("PLAYING");

        List<Player> players = new ArrayList<>();
        for (int i = 0; i < request.playerNames().size(); i++) {
            players.add(new Player(
                    UUID.randomUUID().toString(),
                    request.playerNames().get(i),
                    DEFAULT_HOTKEYS[i],
                    0,
                    false));
        }
        session.setPlayers(players);
        session.setTracks(tracks);
        session.setRoundStartTime(Instant.now());

        activeSessions.put(gameId, session);
        GameStatusResponse response = createResponse(session);
        eventPublisher.publishStatus(response);
        return response;
    }

    public GameStatusResponse registerBuzz(String gameId, String playerId) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"PLAYING".equals(session.getStatus())) {
                return createResponse(session);
            }
            if (session.getActiveGuesserId() != null) {
                return createResponse(session);
            }
            Player player = findPlayer(session, playerId);
            if (player.isLockedOut()) {
                return createResponse(session);
            }
            session.setActiveGuesserId(playerId);
            session.setBuzzTime(Instant.now());
            session.setStatus("GUESSING");
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return response;
        }
    }

    public GuessResponse verifyGuess(String gameId, String playerId, String userText) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"GUESSING".equals(session.getStatus()) || !playerId.equals(session.getActiveGuesserId())) {
                return new GuessResponse(GuessResult.WRONG, 0, createResponse(session));
            }

            SpotifyTrackDto track = session.getCurrentTrack();
            GuessResult result = answerValidator.evaluate(userText, track.title(), track.artist());

            int points = 0;
            if (result != GuessResult.WRONG) {
                points = scoreEngine.calculateScore(result, session.getRoundStartTime(), session.getBuzzTime());
                Player player = findPlayer(session, playerId);
                player.setScore(player.getScore() + points);
                enterReveal(session);
            } else {
                findPlayer(session, playerId).setLockedOut(true);
                if (allPlayersLockedOut(session)) {
                    enterReveal(session);
                } else {
                    session.setActiveGuesserId(null);
                    session.setBuzzTime(null);
                    session.setStatus("PLAYING");
                }
            }

            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return new GuessResponse(result, points, response);
        }
    }

    public GameStatusResponse advanceToNextRound(String gameId) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"REVEAL".equals(session.getStatus())) {
                return createResponse(session);
            }
            session.setCurrentRoundIndex(session.getCurrentRoundIndex() + 1);
            session.getPlayers().forEach(p -> p.setLockedOut(false));
            session.setActiveGuesserId(null);
            session.setBuzzTime(null);

            if (session.getCurrentRoundIndex() >= session.getTracks().size()) {
                session.setStatus("FINISHED");
            } else {
                session.setStatus("PLAYING");
                session.setRoundStartTime(Instant.now());
            }
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return response;
        }
    }

    public GameStatusResponse getCurrentStatus(String gameId) {
        return createResponse(requireSession(gameId));
    }

    private void enterReveal(GameSession session) {
        session.setStatus("REVEAL");
    }

    private GameSession requireSession(String gameId) {
        GameSession session = activeSessions.get(gameId);
        if (session == null) {
            throw new IllegalArgumentException("Nie znaleziono gry o id: " + gameId);
        }
        session.setLastActivity(Instant.now());
        return session;
    }

    private Player findPlayer(GameSession session, String playerId) {
        return session.getPlayers().stream()
                .filter(p -> p.getId().equals(playerId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Gracz nie należy do tej gry: " + playerId));
    }

    private boolean allPlayersLockedOut(GameSession session) {
        return session.getPlayers().stream().allMatch(Player::isLockedOut);
    }

    private GameStatusResponse createResponse(GameSession s) {
        if (s == null) return null;
        SpotifyTrackDto current = s.getCurrentTrack();
        String status = s.getStatus();
        boolean playing = "PLAYING".equals(status);
        boolean reveal = "REVEAL".equals(status) || "FINISHED".equals(status);

        TrackReveal revealedTrack = null;
        if (reveal && current != null) {
            revealedTrack = new TrackReveal(current.title(), current.artist(), current.coverUrl());
        }

        return new GameStatusResponse(
                s.getGameId(),
                status,
                Math.min(s.getCurrentRoundIndex() + 1, s.getTracks().size()),
                s.getTracks().size(),
                s.getPlayers(),
                s.getActiveGuesserId(),
                playing && current != null ? current.uri() : null,
                playing && current != null ? current.previewUrl() : null,
                revealedTrack
        );
    }

    Map<String, GameSession> getActiveSessionsView() {
        return activeSessions;
    }
}
