package com.wolfship.melodia.external.musicbrainz;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pobiera aliasy wykonawcow z MusicBrainz (np. "P!nk" dla "Pink").
 * API darmowe, ale limit 1 req/s na User-Agent — cache w pamieci pozwala
 * unikac powtornych zapytan w obrebie sesji.
 */
@Slf4j
@Service
public class MusicBrainzService {

    private static final String API_BASE = "https://musicbrainz.org/ws/2";
    private static final String USER_AGENT = "JakaToMelodia/0.1 ( https://github.com/wolfship/melodia )";
    private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient = RestClient.builder()
            .baseUrl(API_BASE)
            .defaultHeader("User-Agent", USER_AGENT)
            .defaultHeader("Accept", "application/json")
            .build();

    private final Map<String, Set<String>> aliasCache = new ConcurrentHashMap<>();

    public Set<String> getArtistAliases(String artistName) {
        if (artistName == null || artistName.isBlank()) return Set.of();
        String key = artistName.toLowerCase();
        Set<String> cached = aliasCache.get(key);
        if (cached != null) return cached;
        Set<String> result = fetchAliases(artistName);
        aliasCache.put(key, result);
        return result;
    }

    private Set<String> fetchAliases(String artistName) {
        try {
            Map<String, Object> body = restClient.get()
                    .uri(uri -> uri.path("/artist")
                            .queryParam("query", "artist:\"" + escape(artistName) + "\"")
                            .queryParam("fmt", "json")
                            .queryParam("limit", 1)
                            .build())
                    .retrieve()
                    .body(JSON_OBJECT);
            if (body == null) return Set.of();
            Object rawArtists = body.get("artists");
            if (!(rawArtists instanceof List<?> artists) || artists.isEmpty()) return Set.of();
            Object first = artists.get(0);
            if (!(first instanceof Map<?, ?> artist)) return Set.of();

            Set<String> result = new LinkedHashSet<>();
            if (artist.get("name") instanceof String name && !name.isBlank()) {
                result.add(name);
            }
            Object rawAliases = artist.get("aliases");
            if (rawAliases instanceof List<?> aliases) {
                for (Object a : aliases) {
                    if (a instanceof Map<?, ?> alias && alias.get("name") instanceof String n && !n.isBlank()) {
                        result.add(n);
                    }
                }
            }
            return Set.copyOf(result);
        } catch (RuntimeException e) {
            log.warn("MusicBrainz lookup nieudany dla '{}': {}", artistName, e.getMessage());
            return Set.of();
        }
    }

    private String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
