package com.wolfship.melodia.external.spotify.model;

public record PlaylistDto(
        String id,
        String name,
        int trackCount,
        String coverUrl,
        String ownerId,
        String ownerName,
        boolean spotifyOwned
) {}
