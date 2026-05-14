package com.wolfship.melodia.shared.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Czyta `Authorization: Bearer <jwt>` i wystawia Authentication z PlayerPrincipal.
 * Opportunistyczny — brak nagłówka lub niepoprawny token nie blokuje requestu
 * (host używa cookie OAuth2, players używają Bearer).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            try {
                Claims claims = jwtService.verify(token);
                String playerId = claims.getSubject();
                String gameId = claims.get(JwtService.CLAIM_GAME_ID, String.class);
                String role = claims.get(JwtService.CLAIM_ROLE, String.class);
                if (playerId != null && gameId != null) {
                    PlayerPrincipal principal = new PlayerPrincipal(playerId, gameId, role);
                    AbstractAuthenticationToken auth = new JwtAuthenticationToken(
                            principal,
                            List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "PLAYER" : role.toUpperCase()))));
                    auth.setAuthenticated(true);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException e) {
                log.debug("JWT verify failed: {}", e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }

    static class JwtAuthenticationToken extends AbstractAuthenticationToken {
        private final PlayerPrincipal principal;

        JwtAuthenticationToken(PlayerPrincipal principal, List<SimpleGrantedAuthority> authorities) {
            super(authorities);
            this.principal = principal;
        }

        @Override public Object getCredentials() { return ""; }
        @Override public Object getPrincipal() { return principal; }
    }
}
