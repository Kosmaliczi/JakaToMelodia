package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GameSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SessionCleanupService {

    private final GameService gameService;

    @Value("${melodia.session.ttl-minutes:120}")
    private long ttlMinutes;

    @Scheduled(fixedDelayString = "${melodia.session.cleanup-interval-minutes:10}", timeUnit = java.util.concurrent.TimeUnit.MINUTES)
    public void purgeStaleSessions() {
        Instant threshold = Instant.now().minus(Duration.ofMinutes(ttlMinutes));
        Map<String, GameSession> sessions = gameService.getActiveSessionsView();
        int removed = 0;
        Iterator<Map.Entry<String, GameSession>> it = sessions.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, GameSession> entry = it.next();
            GameSession s = entry.getValue();
            Instant last = s.getLastActivity() != null ? s.getLastActivity() : s.getRoundStartTime();
            if (last == null || last.isBefore(threshold) || "FINISHED".equals(s.getStatus())) {
                it.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.info("SessionCleanupService usunął {} sesji (TTL = {} min)", removed, ttlMinutes);
        }
    }
}
