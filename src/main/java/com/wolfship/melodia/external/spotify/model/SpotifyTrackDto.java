package com.wolfship.melodia.external.spotify.model;

public record SpotifyTrackDto(
        String id,
        String uri,
        String title,
        String artist,
        String previewUrl,
        String coverUrl,
        int durationMs
) {}
