package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GuessResult;
import com.wolfship.melodia.shared.utils.SimilarityMatcher;
import com.wolfship.melodia.shared.utils.StringNormalizer;
import org.springframework.stereotype.Service;

@Service
public class AnswerValidator {
    private static final double THRESHOLD = 0.85;

    public GuessResult evaluate(String guess, String title, String artist) {
        String g = StringNormalizer.normalize(guess);
        String t = StringNormalizer.normalize(title);
        String a = StringNormalizer.normalize(artist);

        if (g.isEmpty()) return GuessResult.WRONG;

        boolean fullMatch =
                SimilarityMatcher.getSimilarity(g, a + " " + t) >= THRESHOLD ||
                SimilarityMatcher.getSimilarity(g, t + " " + a) >= THRESHOLD;
        if (fullMatch) return GuessResult.BOTH;

        boolean titleHit = SimilarityMatcher.getSimilarity(g, t) >= THRESHOLD || containsPhrase(g, t);
        boolean artistHit = SimilarityMatcher.getSimilarity(g, a) >= THRESHOLD || containsPhrase(g, a);

        if (titleHit && artistHit) return GuessResult.BOTH;
        if (titleHit) return GuessResult.TITLE_ONLY;
        if (artistHit) return GuessResult.ARTIST_ONLY;
        return GuessResult.WRONG;
    }

    private boolean containsPhrase(String haystack, String needle) {
        if (needle.isEmpty()) return false;
        return (" " + haystack + " ").contains(" " + needle + " ");
    }
}
