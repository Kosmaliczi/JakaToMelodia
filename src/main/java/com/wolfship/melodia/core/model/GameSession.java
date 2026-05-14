package com.wolfship.melodia.core.model;

import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
public class GameSession {
    private String gameId;
    /**
     * 6-znakowy kod pokoju (alfabet bez I/O/0/1), pokazywany graczom
     * do dołączenia z innego urządzenia. Wprowadzone w 0.2 (Faza 1).
     */
    private String roomCode;
    private List<Player> players;
    private List<SpotifyTrackDto> tracks;
    private int currentRoundIndex = 0;
    private String activeGuesserId = null;
    private Instant roundStartTime;
    private Instant buzzTime;
    private Instant lastActivity = Instant.now();
    private String status;

    public SpotifyTrackDto getCurrentTrack() {
        if (tracks == null || currentRoundIndex >= tracks.size()) return null;
        return tracks.get(currentRoundIndex);
    }
}