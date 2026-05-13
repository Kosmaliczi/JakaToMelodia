package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GuessResult;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class ScoreEngine {
    private static final int MAX_BASE_POINTS = 1000;
    private static final int MIN_BASE_POINTS = 100;
    private static final double TIME_PENALTY_PER_SECOND = 30.0;

    public int calculateScore(GuessResult result, Instant roundStartTime, Instant buzzTime) {
        if (result == null || result == GuessResult.WRONG) return 0;

        int base = baseFor(result);
        if (roundStartTime == null || buzzTime == null) return Math.max(base, MIN_BASE_POINTS);

        long secondsElapsed = Math.max(0, Duration.between(roundStartTime, buzzTime).toSeconds());
        int score = (int) (base - (secondsElapsed * TIME_PENALTY_PER_SECOND));
        return Math.max(score, MIN_BASE_POINTS);
    }

    private int baseFor(GuessResult result) {
        return switch (result) {
            case BOTH -> MAX_BASE_POINTS;
            case TITLE_ONLY -> (int) (MAX_BASE_POINTS * 0.6);
            case ARTIST_ONLY -> (int) (MAX_BASE_POINTS * 0.4);
            case WRONG -> 0;
        };
    }
}
