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
import org.springframework.security.core.Authentication;
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
 *
 * KLUCZOWE: po obsłudze żądania PRZYWRACA poprzedni Authentication, żeby
 * krótkotrwały PlayerPrincipal nie wyciekł do HTTP session i nie zatruł
 * kolejnych żądań na tym samym JSESSIONID (np. hosta w innej karcie tej
 * samej przeglądarki). Bez tego host po kliknięciu Start dostaje 403, bo
 * Spring wczytał PlayerPrincipal zapisany podczas /ready gracza.
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
        Authentication originalAuth = SecurityContextHolder.getContext().getAuthentication();
        String header = request.getHeader("Authorization");
        boolean hasBearer = header != null && header.startsWith(BEARER_PREFIX);

        // Sprzątanie sesji: jeśli w SecurityContext leży stary PlayerPrincipal
        // (zapisany do sesji w jakimś wcześniejszym buggy requeście), a obecne
        // żądanie nie ma Bearera, kasujemy. Sesja nie może utrzymywać tożsamości
        // playera bez aktywnego tokenu w żądaniu.
        if (!hasBearer && originalAuth instanceof JwtAuthenticationToken) {
            log.debug("Czyszczę stary PlayerPrincipal z SecurityContext (brak Bearer w {})", request.getRequestURI());
            SecurityContextHolder.clearContext();
            originalAuth = null;
        }

        boolean overrode = false;
        if (hasBearer) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            try {
                Claims claims = jwtService.verify(token);
                String playerId = claims.getSubject();
                String gameId = claims.get(JwtService.CLAIM_GAME_ID, String.class);
                String role = claims.get(JwtService.CLAIM_ROLE, String.class);
                if (playerId != null && gameId != null) {
                    PlayerPrincipal principal = new PlayerPrincipal(playerId, gameId, role);
                    JwtAuthenticationToken auth = new JwtAuthenticationToken(
                            principal,
                            List.of(new SimpleGrantedAuthority("ROLE_" + (role == null ? "PLAYER" : role.toUpperCase()))));
                    auth.setAuthenticated(true);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    overrode = true;
                }
            } catch (JwtException e) {
                log.debug("JWT verify failed: {}", e.getMessage());
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            // Przywracamy poprzedni stan żeby NIC w pipeline'ie Springa nie
            // zapisało naszego PlayerPrincipal do sesji HTTP. Host w innej
            // karcie z tym samym JSESSIONID dostanie czystą sesję.
            if (overrode) {
                if (originalAuth == null) {
                    SecurityContextHolder.clearContext();
                } else {
                    SecurityContextHolder.getContext().setAuthentication(originalAuth);
                }
            }
        }
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
