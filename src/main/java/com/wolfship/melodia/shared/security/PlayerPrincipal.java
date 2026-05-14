package com.wolfship.melodia.shared.security;

import java.security.Principal;

/**
 * Principal reprezentujący gracza zidentyfikowanego przez JWT.
 * Używany w SecurityContext oraz jako STOMP user (Faza 3).
 */
public record PlayerPrincipal(String playerId, String gameId, String role) implements Principal {
    @Override
    public String getName() {
        return playerId;
    }

    public boolean isHost() {
        return JwtService.ROLE_HOST.equalsIgnoreCase(role);
    }
}
