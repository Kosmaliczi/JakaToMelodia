package com.wolfship.melodia.external.spotify;

import com.wolfship.melodia.external.spotify.model.PlaylistDto;
import com.wolfship.melodia.external.spotify.model.SpotifyTrackDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * UWAGA: Spotify w 2025 r. przemianowało pola w playlist API:
 *   playlist.tracks  → playlist.items
 *   playlistTrack.track → playlistTrack.item
 *   /playlists/{id}/tracks  → /playlists/{id}/items
 * Stare endpointy zwracają 403 w trybie Development, a stare nazwy pól w `fields=`
 * dają pustą odpowiedź `{}`. Parsujemy nowe nazwy z fallbackiem na stare.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpotifyService {

    private static final String API_BASE = "https://api.spotify.com/v1";
    private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT =
            new ParameterizedTypeReference<>() {};
    private static final int MAX_TRACKS = 500;

    private final OAuth2AuthorizedClientService authorizedClientService;
    private final RestClient restClient = RestClient.builder().baseUrl(API_BASE).build();

    public List<PlaylistDto> getCurrentUserPlaylists() {
        String token = requireToken();
        List<PlaylistDto> all = new ArrayList<>();
        String next = "/me/playlists?limit=50";
        while (next != null) {
            Map<String, Object> page = call(next, token);
            if (page == null) break;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items =
                    (List<Map<String, Object>>) page.getOrDefault("items", List.of());
            for (Map<String, Object> p : items) {
                if (p == null) continue;
                all.add(mapPlaylist(p));
            }
            next = relativeNext((String) page.get("next"));
        }
        return all;
    }

    public List<SpotifyTrackDto> getTracks(String playlistId, int count) {
        if (playlistId == null || playlistId.isBlank()) {
            throw new IllegalArgumentException("playlistId jest wymagane");
        }
        String token = requireToken();

        // /playlists/{id} z fields= pokazującym tylko to, czego potrzebujemy.
        // Używamy NOWYCH nazw pól (items.items + item). Bez preview_url, którego
        // i tak nie używamy, a wymusza ono dodatkowe restrykcje w dev mode.
        Map<String, Object> body = call(
                "/playlists/" + playlistId
                        + "?fields=items.items(is_local,item(id,uri,name,type,duration_ms,artists(name),album(images(url)))),items.next",
                token);

        List<SpotifyTrackDto> collected = new ArrayList<>(extractTracks(body, playlistId, "primary"));
        String next = extractNextLink(body);
        while (next != null && collected.size() < MAX_TRACKS) {
            Map<String, Object> page = call(next, token);
            if (page == null) break;
            collected.addAll(extractTracksFromPage(page, playlistId, "page"));
            next = relativeNext((String) page.get("next"));
        }

        if (collected.isEmpty()) {
            // Awaryjnie: pełne /playlists/{id} bez fields — działa, bo Spotify zwraca
            // wtedy natywną strukturę z items.items[*].item.
            log.info("Empty result from primary fetch for {}, falling back to no-fields", playlistId);
            Map<String, Object> full = call("/playlists/" + playlistId, token);
            collected.addAll(extractTracks(full, playlistId, "fallback-no-fields"));
        }

        Collections.shuffle(collected);
        if (collected.size() > count) {
            return new ArrayList<>(collected.subList(0, count));
        }
        return collected;
    }

    private List<SpotifyTrackDto> extractTracks(Map<String, Object> body, String playlistId, String source) {
        if (body == null) {
            log.warn("{}: body=null dla {}", source, playlistId);
            return List.of();
        }
        // Spotify zmieniło "tracks" → "items"; fallback na stare API jeśli ktoś jeszcze ma
        Object container = body.get("items");
        if (container == null) container = body.get("tracks");
        if (!(container instanceof Map<?, ?> tracksObj)) {
            log.warn("{}: brak kontenera items/tracks (keys: {}) dla {}", source, body.keySet(), playlistId);
            return List.of();
        }
        Object rawItems = tracksObj.get("items");
        if (!(rawItems instanceof List<?> items)) {
            log.warn("{}: items[] nie jest listą dla {}", source, playlistId);
            return List.of();
        }
        return collectFromItems(items, playlistId, source);
    }

    private List<SpotifyTrackDto> extractTracksFromPage(Map<String, Object> page, String playlistId, String source) {
        Object rawItems = page.get("items");
        if (!(rawItems instanceof List<?> items)) {
            return List.of();
        }
        return collectFromItems(items, playlistId, source);
    }

    private List<SpotifyTrackDto> collectFromItems(List<?> items, String playlistId, String source) {
        List<SpotifyTrackDto> collected = new ArrayList<>();
        int rejected = 0;
        for (Object raw : items) {
            if (raw instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                SpotifyTrackDto dto = mapPlaylistTrack((Map<String, Object>) map);
                if (dto != null) collected.add(dto);
                else rejected++;
            }
        }
        log.info("{}: {} zaakceptowane, {} odrzucone dla {}", source, collected.size(), rejected, playlistId);
        return collected;
    }

    private String extractNextLink(Map<String, Object> body) {
        if (body == null) return null;
        Object container = body.get("items");
        if (container == null) container = body.get("tracks");
        if (container instanceof Map<?, ?> tr && tr.get("next") instanceof String n) {
            return relativeNext(n);
        }
        return null;
    }

    private Map<String, Object> call(String relativeUrl, String token) {
        try {
            return restClient.get()
                    .uri(relativeUrl)
                    .headers(h -> h.setBearerAuth(token))
                    .retrieve()
                    .body(JSON_OBJECT);
        } catch (RestClientResponseException e) {
            HttpStatusCode status = e.getStatusCode();
            String body = e.getResponseBodyAsString();
            log.warn("Spotify API {} -> {} {}", relativeUrl, status, body);
            throw new IllegalStateException(translateError(status, relativeUrl, body), e);
        } catch (RuntimeException e) {
            log.warn("Spotify API {} -> {}", relativeUrl, e.getMessage());
            throw new IllegalStateException("Błąd komunikacji ze Spotify: " + e.getMessage(), e);
        }
    }

    private String translateError(HttpStatusCode status, String url, String body) {
        if (status.equals(HttpStatus.FORBIDDEN)) {
            return "Spotify zwrócił 403. W trybie Development niektóre endpointy są zablokowane. "
                    + "Spróbuj inną playlistę lub wnioskuj o Extended Quota Mode w Developer Dashboard.";
        }
        if (status.equals(HttpStatus.UNAUTHORIZED)) {
            return "Token Spotify wygasł lub jest niepoprawny. Wyloguj się i zaloguj ponownie.";
        }
        if (status.equals(HttpStatus.NOT_FOUND)) {
            return "Spotify zwrócił 404 - zasób nie został znaleziony.";
        }
        return "Spotify API zwróciło " + status + ": " + body;
    }

    private String relativeNext(String fullUrl) {
        if (fullUrl == null) return null;
        int idx = fullUrl.indexOf("/v1/");
        return idx >= 0 ? fullUrl.substring(idx + 3) : fullUrl;
    }

    private PlaylistDto mapPlaylist(Map<String, Object> p) {
        String id = asString(p.get("id"));
        String name = asString(p.getOrDefault("name", ""));

        // Nowe API: items.total; stare API: tracks.total (fallback)
        int total = 0;
        Object container = p.get("items");
        if (container == null) container = p.get("tracks");
        if (container instanceof Map<?, ?> tracks
                && tracks.get("total") instanceof Number n) {
            total = n.intValue();
        }

        String coverUrl = firstImageUrl(p.get("images"));

        String ownerId = null;
        String ownerName = null;
        if (p.get("owner") instanceof Map<?, ?> owner) {
            ownerId = asString(owner.get("id"));
            ownerName = asString(owner.get("display_name"));
        }
        boolean spotifyOwned = "spotify".equalsIgnoreCase(ownerId);

        return new PlaylistDto(id, name, total, coverUrl, ownerId, ownerName, spotifyOwned);
    }

    private SpotifyTrackDto mapPlaylistTrack(Map<String, Object> wrapper) {
        if (wrapper == null) return null;
        if (Boolean.TRUE.equals(wrapper.get("is_local"))) return null;

        // Nowe API: pole "item"; stare: "track" (fallback)
        Object trackObj = wrapper.get("item");
        if (trackObj == null) trackObj = wrapper.get("track");
        if (!(trackObj instanceof Map<?, ?> rawTrack)) return null;
        @SuppressWarnings("unchecked")
        Map<String, Object> t = (Map<String, Object>) rawTrack;

        String type = asString(t.get("type"));
        if (type != null && !type.equals("track")) return null;
        // Dodatkowy filtr na nowy flag "episode"
        if (Boolean.TRUE.equals(t.get("episode"))) return null;

        String uri = asString(t.get("uri"));
        if (uri == null || uri.isBlank()) return null;

        String id = asString(t.get("id"));
        String name = asString(t.getOrDefault("name", ""));
        String previewUrl = asString(t.get("preview_url"));
        int durationMs = t.get("duration_ms") instanceof Number d ? d.intValue() : 0;

        String artist = "";
        if (t.get("artists") instanceof List<?> artists && !artists.isEmpty()
                && artists.get(0) instanceof Map<?, ?> first
                && first.get("name") instanceof String an) {
            artist = an;
        }

        String coverUrl = null;
        if (t.get("album") instanceof Map<?, ?> album) {
            coverUrl = firstImageUrl(album.get("images"));
        }

        return new SpotifyTrackDto(id, uri, name, artist, previewUrl, coverUrl, durationMs);
    }

    private String firstImageUrl(Object images) {
        if (images instanceof List<?> list && !list.isEmpty()
                && list.get(0) instanceof Map<?, ?> first
                && first.get("url") instanceof String url) {
            return url;
        }
        return null;
    }

    private String asString(Object o) {
        return o == null ? null : o.toString();
    }

    private String requireToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof OAuth2AuthenticationToken token)) {
            throw new IllegalStateException("Brak zalogowanego użytkownika Spotify (OAuth2)");
        }
        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                token.getAuthorizedClientRegistrationId(), token.getName());
        if (client == null || client.getAccessToken() == null) {
            throw new IllegalStateException("Brak ważnego tokenu dostępu do Spotify");
        }
        return client.getAccessToken().getTokenValue();
    }
}
