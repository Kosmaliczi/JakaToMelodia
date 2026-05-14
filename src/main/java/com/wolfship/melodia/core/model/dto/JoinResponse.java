package com.wolfship.melodia.core.model.dto;

public record JoinResponse(
        String token,
        String playerId,
        String gameId,
        String roomCode,
        String hotkey,
        long expiresInSeconds
) {}
