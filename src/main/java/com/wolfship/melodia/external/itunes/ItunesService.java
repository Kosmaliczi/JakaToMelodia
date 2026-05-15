package com.wolfship.melodia.external.itunes;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Wyszukuje 30-sekundowe podglady utworow w iTunes Search API.
 * API jest darmowe, bez autoryzacji, limit ~20 req/min - cache'ujemy lokalnie.
 *
 * UWAGA: iTunes zwraca Content-Type: text/javascript (historycznie pod JSONP).
 * RestClient nie ma domyślnie konwertera dla tego mediatype, więc czytamy
 * surowy String i parsujemy Jacksonem.
 */
@Slf4j
@Service
public class ItunesService {

    private static final String API_BASE = "https://itunes.apple.com";
    private static final TypeReference<Map<String, Object>> JSON_MAP = new TypeReference<>() {};

    private final RestClient restClient = RestClient.builder()
            .baseUrl(API_BASE)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Optional<String>> cache = new ConcurrentHashMap<>();

    public Optional<String> findPreviewUrl(String title, String artist) {
        if (title == null || title.isBlank()) return Optional.empty();
        String key = cacheKey(title, artist);
        Optional<String> cached = cache.get(key);
        if (cached != null) return cached;
        Optional<String> result = fetch(title, artist);
        cache.put(key, result);
        return result;
    }

    private Optional<String> fetch(String title, String artist) {
        String term = (artist == null ? "" : artist + " ") + title;
        try {
            String raw = restClient.get()
                    .uri(uri -> uri.path("/search")
                            .queryParam("term", term)
                            .queryParam("entity", "song")
                            .queryParam("limit", 1)
                            .build())
                    .retrieve()
                    .body(String.class);
            if (raw == null || raw.isBlank()) return Optional.empty();
            Map<String, Object> body = objectMapper.readValue(raw, JSON_MAP);
            Object rawResults = body.get("results");
            if (!(rawResults instanceof List<?> results) || results.isEmpty()) {
                return Optional.empty();
            }
            Object first = results.get(0);
            if (!(first instanceof Map<?, ?> entry)) return Optional.empty();
            Object preview = entry.get("previewUrl");
            if (preview instanceof String s && !s.isBlank()) {
                return Optional.of(s);
            }
            return Optional.empty();
        } catch (Exception e) {
            log.warn("iTunes lookup nieudany dla '{}' - {}: {}", artist, title, e.getMessage());
            return Optional.empty();
        }
    }

    private String cacheKey(String title, String artist) {
        return (artist == null ? "" : artist.toLowerCase()) + "||" + title.toLowerCase();
    }
}
