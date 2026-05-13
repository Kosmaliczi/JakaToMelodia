package com.wolfship.melodia.core.model.dto;

import com.wolfship.melodia.core.model.Player;
import java.util.List;

public record GameStatusResponse(
        String gameId,
        String status,
        int currentRound,
        int totalRounds,
        List<Player> players,
        String activeGuesserId,
        String currentTrackUri,
        String currentTrackPreviewUrl,
        TrackReveal revealedTrack
) {
    public record TrackReveal(String title, String artist, String coverUrl) {}
}
