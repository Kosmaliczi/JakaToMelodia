package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GameSession;
import com.wolfship.melodia.core.model.GuessResult;
import com.wolfship.melodia.core.model.Player;
import com.wolfship.melodia.core.model.dto.GameStatusResponse;
import com.wolfship.melodia.core.model.dto.GameStatusResponse.TrackReveal;
import com.wolfship.melodia.core.model.dto.GuessResponse;
import com.wolfship.melodia.core.model.dto.CreateLobbyRequest;
import com.wolfship.melodia.core.model.dto.StartGameRequest;
import com.wolfship.melodia.external.itunes.ItunesService;
import com.wolfship.melodia.external.musicbrainz.MusicBrainzService;
import com.wolfship.melodia.external.spotify.SpotifyService;
import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class GameService {

    private static final String[] DEFAULT_HOTKEYS = {"Q", "P", "Z", "M"};
    private static final char[] ROOM_CODE_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int ROOM_CODE_LENGTH = 6;
    private static final int ROOM_CODE_MAX_ATTEMPTS = 8;

    private final SpotifyService spotifyService;
    private final ItunesService itunesService;
    private final MusicBrainzService musicBrainzService;
    private final AnswerValidator answerValidator;
    private final ScoreEngine scoreEngine;
    private final GameEventPublisher eventPublisher;

    private final Map<String, GameSession> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, String> roomCodeIndex = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public GameStatusResponse initializeGame(StartGameRequest request) {
        if (request.playerNames() == null || request.playerNames().isEmpty() || request.playerNames().size() > 4) {
            throw new IllegalArgumentException("Liczba graczy startowych musi być w zakresie 1-4 (reszta może dołączyć po kodzie pokoju)");
        }
        if (request.totalRounds() <= 0) {
            throw new IllegalArgumentException("Liczba rund musi być dodatnia");
        }

        List<SpotifyTrackDto> tracks = spotifyService.getTracks(request.playlistId(), request.totalRounds());
        if (tracks.isEmpty()) {
            throw new IllegalStateException("Brak grywalnych utworów w wybranej playliście");
        }
        tracks = enrichWithItunesPreview(tracks);

        String gameId = UUID.randomUUID().toString();
        String roomCode = generateUniqueRoomCode();
        GameSession session = new GameSession();
        session.setGameId(gameId);
        session.setRoomCode(roomCode);
        session.setStatus("PLAYING");

        List<Player> players = new ArrayList<>();
        for (int i = 0; i < request.playerNames().size(); i++) {
            // Flow immediate-start: ready=true (lobby check pomijany)
            players.add(new Player(
                    UUID.randomUUID().toString(),
                    request.playerNames().get(i),
                    DEFAULT_HOTKEYS[i],
                    0,
                    false,
                    null,
                    true));
        }
        session.setPlayers(players);
        session.setTracks(tracks);
        session.setRoundStartTime(Instant.now());

        activeSessions.put(gameId, session);
        roomCodeIndex.put(roomCode, gameId);
        GameStatusResponse response = createResponse(session);
        eventPublisher.publishStatus(response);
        return response;
    }

    /**
     * Faza 2.5 (lobby): tworzy pokój w statusie WAITING.
     * Utwory są ładowane od razu (i wzbogacane przez iTunes), żeby start gry
     * był natychmiastowy. Brak graczy na początku — wszyscy dołączają po kodzie.
     */
    public GameStatusResponse initializeLobby(CreateLobbyRequest request) {
        if (request.totalRounds() <= 0) {
            throw new IllegalArgumentException("Liczba rund musi być dodatnia");
        }
        if (request.playlistId() == null || request.playlistId().isBlank()) {
            throw new IllegalArgumentException("playlistId jest wymagane");
        }

        List<SpotifyTrackDto> tracks = spotifyService.getTracks(request.playlistId(), request.totalRounds());
        if (tracks.isEmpty()) {
            throw new IllegalStateException("Brak grywalnych utworów w wybranej playliście");
        }
        tracks = enrichWithItunesPreview(tracks);

        String gameId = UUID.randomUUID().toString();
        String roomCode = generateUniqueRoomCode();
        GameSession session = new GameSession();
        session.setGameId(gameId);
        session.setRoomCode(roomCode);
        session.setStatus("WAITING");
        session.setPlayers(new ArrayList<>());
        session.setTracks(tracks);
        // roundStartTime = null dopóki host nie wystartuje

        // Host też gra: jeśli podał swój nick, dodajemy go jako pierwszego
        // gracza z hotkeyem Q i ready=true (host nie potrzebuje toggle ready,
        // i tak on klika "Rozpocznij grę").
        if (request.hostName() != null && !request.hostName().isBlank()) {
            String trimmed = request.hostName().trim();
            if (trimmed.length() < 2 || trimmed.length() > 20) {
                throw new IllegalArgumentException("Nick hosta musi mieć 2-20 znaków");
            }
            Player host = new Player(
                    UUID.randomUUID().toString(),
                    trimmed,
                    DEFAULT_HOTKEYS[0],
                    0,
                    false,
                    null,
                    true);
            session.getPlayers().add(host);
        }

        activeSessions.put(gameId, session);
        roomCodeIndex.put(roomCode, gameId);
        GameStatusResponse response = createResponse(session);
        eventPublisher.publishStatus(response);
        return response;
    }

    /**
     * Faza 2.5 (lobby): host przełącza grę z WAITING na PLAYING gdy wszyscy gotowi.
     */
    public GameStatusResponse startWaitingGame(String gameId) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"WAITING".equals(session.getStatus())) {
                throw new IllegalStateException("Gra nie jest w lobby (status: " + session.getStatus() + ")");
            }
            if (session.getPlayers().isEmpty()) {
                throw new IllegalStateException("Brak graczy w lobby");
            }
            for (Player p : session.getPlayers()) {
                if (!p.isReady()) {
                    throw new IllegalStateException("Nie wszyscy gracze są gotowi");
                }
            }
            session.setStatus("PLAYING");
            session.setRoundStartTime(Instant.now());
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return response;
        }
    }

    /**
     * Faza 2.5 (lobby): gracz przełącza swój status gotowości.
     */
    public GameStatusResponse setPlayerReady(String gameId, String playerId, boolean ready) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"WAITING".equals(session.getStatus())) {
                return createResponse(session);
            }
            Player p = findPlayer(session, playerId);
            p.setReady(ready);
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return response;
        }
    }

    public String resolveGameIdByCode(String code) {
        if (code == null) return null;
        return roomCodeIndex.get(code.toUpperCase());
    }

    /**
     * Faza 2 (0.2): dodaje gracza do istniejącej gry po kodzie pokoju.
     * Zwraca nowo utworzony Player. Rzuca, jeśli gra zakończona,
     * pełna lub nick zajęty.
     */
    public Player addPlayer(String gameId, String name) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if ("FINISHED".equals(session.getStatus())) {
                throw new IllegalStateException("Gra już się zakończyła");
            }
            String trimmed = name == null ? "" : name.trim();
            if (trimmed.length() < 2 || trimmed.length() > 20) {
                throw new IllegalArgumentException("Nick musi mieć 2-20 znaków");
            }
            for (Player p : session.getPlayers()) {
                if (p.getName().equalsIgnoreCase(trimmed)) {
                    throw new IllegalStateException("Nick '" + trimmed + "' jest już zajęty w tym pokoju");
                }
            }
            String hotkey = nextAvailableHotkey(session);
            if (hotkey == null) {
                throw new IllegalStateException("Pokój jest pełny (max " + DEFAULT_HOTKEYS.length + " graczy)");
            }
            // Flow lobby: ready=false dopóki gracz nie kliknie "Gotowy"
            boolean initialReady = !"WAITING".equals(session.getStatus());
            Player player = new Player(
                    UUID.randomUUID().toString(),
                    trimmed,
                    hotkey,
                    0,
                    false,
                    null,
                    initialReady);
            session.getPlayers().add(player);
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return player;
        }
    }

    private String nextAvailableHotkey(GameSession session) {
        Set<String> taken = new java.util.HashSet<>();
        for (Player p : session.getPlayers()) {
            if (p.getHotkey() != null) taken.add(p.getHotkey());
        }
        for (String k : DEFAULT_HOTKEYS) {
            if (!taken.contains(k)) return k;
        }
        return null;
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
            Set<String> artistAliases = musicBrainzService.getArtistAliases(track.artist());
            GuessResult result = answerValidator.evaluate(
                    userText, track.title(), track.artist(), List.of(), artistAliases);

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

    public GameStatusResponse skipCurrentTrack(String gameId) {
        GameSession session = requireSession(gameId);
        synchronized (session) {
            if (!"PLAYING".equals(session.getStatus())) {
                return createResponse(session);
            }
            session.setActiveGuesserId(null);
            session.setBuzzTime(null);
            enterReveal(session);
            GameStatusResponse response = createResponse(session);
            eventPublisher.publishStatus(response);
            return response;
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

        Long roundStartedAtMs = s.getRoundStartTime() == null ? null : s.getRoundStartTime().toEpochMilli();
        return new GameStatusResponse(
                s.getGameId(),
                s.getRoomCode(),
                status,
                Math.min(s.getCurrentRoundIndex() + 1, s.getTracks().size()),
                s.getTracks().size(),
                s.getPlayers(),
                s.getActiveGuesserId(),
                playing && current != null ? current.uri() : null,
                playing && current != null ? current.previewUrl() : null,
                revealedTrack,
                roundStartedAtMs
        );
    }

    Map<String, GameSession> getActiveSessionsView() {
        return activeSessions;
    }

    void removeSession(String gameId) {
        GameSession removed = activeSessions.remove(gameId);
        if (removed != null && removed.getRoomCode() != null) {
            roomCodeIndex.remove(removed.getRoomCode(), gameId);
        }
    }

    private String generateUniqueRoomCode() {
        for (int attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
            char[] buf = new char[ROOM_CODE_LENGTH];
            for (int i = 0; i < ROOM_CODE_LENGTH; i++) {
                buf[i] = ROOM_CODE_ALPHABET[random.nextInt(ROOM_CODE_ALPHABET.length)];
            }
            String candidate = new String(buf);
            if (!roomCodeIndex.containsKey(candidate)) return candidate;
        }
        throw new IllegalStateException("Nie udało się wygenerować unikalnego kodu pokoju");
    }

    private List<SpotifyTrackDto> enrichWithItunesPreview(List<SpotifyTrackDto> tracks) {
        List<SpotifyTrackDto> enriched = new ArrayList<>(tracks.size());
        for (SpotifyTrackDto t : tracks) {
            if (t.previewUrl() != null && !t.previewUrl().isBlank()) {
                enriched.add(t);
                continue;
            }
            String fromItunes = itunesService.findPreviewUrl(t.title(), t.artist()).orElse(null);
            enriched.add(new SpotifyTrackDto(
                    t.id(), t.uri(), t.title(), t.artist(),
                    fromItunes, t.coverUrl(), t.durationMs()));
        }
        return enriched;
    }
}
