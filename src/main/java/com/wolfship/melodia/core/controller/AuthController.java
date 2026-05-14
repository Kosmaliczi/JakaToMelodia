package com.wolfship.melodia.core.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT =
            new ParameterizedTypeReference<>() {};
    private static final TypeReference<Map<String, Object>> JSON_MAP =
            new TypeReference<>() {};

    private final OAuth2AuthorizedClientService authorizedClientService;
    private final ObjectMapper objectMapper;
    private final RestClient spotifyClient =
            RestClient.builder().baseUrl("https://api.spotify.com/v1").build();

    public AuthController(OAuth2AuthorizedClientService authorizedClientService,
                          ObjectMapper objectMapper) {
        this.authorizedClientService = authorizedClientService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        Map<String, Object> body = new HashMap<>();
        body.put("loginUrl", "/oauth2/authorization/wolfship-auth");
        OAuth2AuthorizedClient client = currentClient();
        boolean authenticated = client != null && client.getAccessToken() != null;
        body.put("authenticated", authenticated);
        if (authenticated) {
            OAuth2AccessToken access = client.getAccessToken();
            body.put("scopes", access.getScopes());
            body.put("tokenExpiresAt", access.getExpiresAt() == null
                    ? null : access.getExpiresAt().toString());
        }
        return body;
    }

    @GetMapping("/token")
    public ResponseEntity<Map<String, Object>> token() {
        OAuth2AuthorizedClient client = currentClient();
        if (client == null || client.getAccessToken() == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "Nie zalogowano",
                    "loginUrl", "/oauth2/authorization/wolfship-auth"));
        }
        OAuth2AccessToken access = client.getAccessToken();
        long expiresIn = access.getExpiresAt() == null ? 3600 :
                Math.max(0, access.getExpiresAt().getEpochSecond() - Instant.now().getEpochSecond());
        return ResponseEntity.ok(Map.of(
                "accessToken", access.getTokenValue(),
                "expiresIn", expiresIn
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof OAuth2AuthenticationToken oauth) {
            authorizedClientService.removeAuthorizedClient(
                    oauth.getAuthorizedClientRegistrationId(), oauth.getName());
        }
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();

        Cookie expired = new Cookie("JSESSIONID", "");
        expired.setPath("/");
        expired.setMaxAge(0);
        expired.setHttpOnly(true);
        response.addCookie(expired);

        return ResponseEntity.ok(Map.of(
                "loggedOut", true,
                "redirectTo", "/"
        ));
    }

    /**
     * Probuje 3 endpointy Spotify aktualnym tokenem i raportuje status każdego.
     * Pozwala szybko ustalić, czy token jest stary, czy problem jest po stronie konkretnego endpointu/playlisty.
     */
    @GetMapping("/diagnostics")
    public Map<String, Object> diagnostics(@RequestParam(required = false) String playlistId) {
        Map<String, Object> result = new LinkedHashMap<>();
        OAuth2AuthorizedClient client = currentClient();
        if (client == null || client.getAccessToken() == null) {
            result.put("authenticated", false);
            return result;
        }
        OAuth2AccessToken access = client.getAccessToken();
        result.put("authenticated", true);
        result.put("scopes", access.getScopes());
        result.put("tokenExpiresAt", access.getExpiresAt() == null
                ? null : access.getExpiresAt().toString());

        Set<String> required = Set.of(
                "playlist-read-private", "playlist-read-collaborative",
                "streaming", "user-modify-playback-state", "user-read-playback-state");
        Set<String> missing = new java.util.TreeSet<>(required);
        missing.removeAll(access.getScopes());
        result.put("missingScopes", missing);

        String token = access.getTokenValue();
        Map<String, Object> meProbe = probe(token, "/me");
        result.put("probe_me", meProbe);
        result.put("probe_my_playlists", probe(token, "/me/playlists?limit=1"));

        if (playlistId != null && !playlistId.isBlank()) {
            // NOWE nazwy pól: items.total, items.items, item
            Map<String, Object> playlistProbe = probe(token,
                    "/playlists/" + playlistId + "?fields=id,name,public,collaborative,owner(id,display_name),items(total)");
            result.put("probe_playlist_meta", playlistProbe);
            // Stary endpoint /tracks
            result.put("probe_playlist_tracks_old", probe(token, "/playlists/" + playlistId + "/tracks?limit=1"));
            // Nowy endpoint /items
            result.put("probe_playlist_items_new", probe(token, "/playlists/" + playlistId + "/items?limit=1"));
            // Embedded z NOWĄ składnią fields
            result.put("probe_playlist_embedded_new_fields", probe(token,
                    "/playlists/" + playlistId
                            + "?fields=items.items(is_local,item(id,uri,name,type,duration_ms,artists(name),album(images(url))))"));

            // Porównanie właściciela playlisty z aktualnym userem
            if (Boolean.TRUE.equals(meProbe.get("ok")) && Boolean.TRUE.equals(playlistProbe.get("ok"))) {
                Object myId = meProbe.get("id");
                Object ownerId = playlistProbe.get("ownerId");
                if (myId != null && ownerId != null) {
                    result.put("ownsPlaylist", myId.toString().equals(ownerId.toString()));
                }
            }
        }
        return result;
    }

    private Map<String, Object> probe(String token, String relativeUrl) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("url", relativeUrl);
        try {
            String raw = spotifyClient.get()
                    .uri(relativeUrl)
                    .headers(h -> h.setBearerAuth(token))
                    .retrieve()
                    .body(String.class);
            r.put("ok", true);
            r.put("rawLength", raw == null ? 0 : raw.length());
            if (raw != null) {
                r.put("rawPreview", raw.length() > 2000 ? raw.substring(0, 2000) + "…[truncated]" : raw);
            }
            Map<String, Object> body = null;
            if (raw != null && !raw.isBlank()) {
                try {
                    body = objectMapper.readValue(raw, JSON_MAP);
                } catch (Exception e) {
                    r.put("parseError", e.getMessage());
                }
            }
            if (body != null) {
                Object id = body.get("id");
                if (id != null) r.put("id", id);
                Object name = body.get("name");
                if (name != null) r.put("name", name);
                Object isPublic = body.get("public");
                if (isPublic != null) r.put("public", isPublic);
                Object collab = body.get("collaborative");
                if (collab != null) r.put("collaborative", collab);
                if (body.get("owner") instanceof Map<?, ?> owner) {
                    Object oid = owner.get("id");
                    Object dn = owner.get("display_name");
                    if (oid != null) r.put("ownerId", oid);
                    if (dn != null) r.put("ownerName", dn);
                }
                if (body.get("tracks") instanceof Map<?, ?> tr) {
                    Object total = tr.get("total");
                    if (total != null) r.put("tracksTotal", total);
                    if (tr.get("items") instanceof java.util.List<?> list) {
                        r.put("embeddedItemCount", list.size());
                    }
                }
                Object items = body.get("items");
                if (items instanceof java.util.List<?> list) r.put("itemCount", list.size());
                Object total = body.get("total");
                if (total != null) r.put("total", total);
            }
        } catch (RestClientResponseException e) {
            HttpStatusCode status = e.getStatusCode();
            r.put("ok", false);
            r.put("status", status.value());
            r.put("body", e.getResponseBodyAsString());
        } catch (RuntimeException e) {
            r.put("ok", false);
            r.put("error", e.getMessage());
        }
        return r;
    }

    private OAuth2AuthorizedClient currentClient() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof OAuth2AuthenticationToken token)) return null;
        return authorizedClientService.loadAuthorizedClient(
                token.getAuthorizedClientRegistrationId(), token.getName());
    }
}
