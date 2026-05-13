package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GuessResult;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ScoreEngineTest {

    private final ScoreEngine engine = new ScoreEngine();

    @Test
    void wrongGuessGivesNoPoints() {
        Instant start = Instant.parse("2026-01-01T12:00:00Z");
        Instant buzz = start.plusSeconds(2);
        assertThat(engine.calculateScore(GuessResult.WRONG, start, buzz)).isZero();
    }

    @Test
    void bothMatchAtZeroSecondsGivesMaxPoints() {
        Instant start = Instant.parse("2026-01-01T12:00:00Z");
        assertThat(engine.calculateScore(GuessResult.BOTH, start, start)).isEqualTo(1000);
    }

    @Test
    void titleOnlyHasLowerBaseThanBoth() {
        Instant start = Instant.parse("2026-01-01T12:00:00Z");
        int both = engine.calculateScore(GuessResult.BOTH, start, start);
        int title = engine.calculateScore(GuessResult.TITLE_ONLY, start, start);
        assertThat(title).isLessThan(both);
    }

    @Test
    void artistOnlyHasLowerBaseThanTitleOnly() {
        Instant start = Instant.parse("2026-01-01T12:00:00Z");
        int title = engine.calculateScore(GuessResult.TITLE_ONLY, start, start);
        int artist = engine.calculateScore(GuessResult.ARTIST_ONLY, start, start);
        assertThat(artist).isLessThan(title);
    }

    @Test
    void scoreNeverDropsBelowMinimum() {
        Instant start = Instant.parse("2026-01-01T12:00:00Z");
        Instant buzz = start.plusSeconds(600);
        assertThat(engine.calculateScore(GuessResult.BOTH, start, buzz)).isEqualTo(100);
    }
}
