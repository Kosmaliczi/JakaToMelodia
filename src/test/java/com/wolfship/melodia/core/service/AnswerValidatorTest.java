package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GuessResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AnswerValidatorTest {

    private final AnswerValidator validator = new AnswerValidator();

    @Test
    void recognizesFullMatchAsBoth() {
        assertThat(validator.evaluate("Dżem - Whisky", "Whisky", "Dżem"))
                .isEqualTo(GuessResult.BOTH);
    }

    @Test
    void recognizesTitleOnly() {
        assertThat(validator.evaluate("Whisky", "Whisky", "Dżem"))
                .isEqualTo(GuessResult.TITLE_ONLY);
    }

    @Test
    void recognizesArtistOnly() {
        assertThat(validator.evaluate("Dzem", "Whisky", "Dżem"))
                .isEqualTo(GuessResult.ARTIST_ONLY);
    }

    @Test
    void rejectsRandomString() {
        assertThat(validator.evaluate("kompletnie zle", "Whisky", "Dżem"))
                .isEqualTo(GuessResult.WRONG);
    }

    @Test
    void emptyGuessIsWrong() {
        assertThat(validator.evaluate("", "Whisky", "Dżem"))
                .isEqualTo(GuessResult.WRONG);
    }

    @Test
    void ignoresFeatAndBrackets() {
        assertThat(validator.evaluate("Whisky", "Whisky (Remastered) feat. Someone", "Dżem"))
                .isEqualTo(GuessResult.TITLE_ONLY);
    }

    @Test
    void acceptsArtistAlias() {
        assertThat(validator.evaluate(
                "P!nk - So What",
                "So What",
                "Pink",
                List.of(),
                List.of("P!nk", "Alecia Beth Moore")))
                .isEqualTo(GuessResult.BOTH);
    }

    @Test
    void aliasAloneCountsAsArtistMatch() {
        assertThat(validator.evaluate(
                "Alecia Beth Moore",
                "So What",
                "Pink",
                List.of(),
                List.of("P!nk", "Alecia Beth Moore")))
                .isEqualTo(GuessResult.ARTIST_ONLY);
    }
}
