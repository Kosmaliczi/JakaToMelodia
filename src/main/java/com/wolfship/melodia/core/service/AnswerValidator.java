package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.GuessResult;
import com.wolfship.melodia.shared.utils.SimilarityMatcher;
import com.wolfship.melodia.shared.utils.StringNormalizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
public class AnswerValidator {
    private static final double THRESHOLD = 0.85;

    public GuessResult evaluate(String guess, String title, String artist) {
        return evaluate(guess, title, artist, List.of(), List.of());
    }

    public GuessResult evaluate(String guess,
                                String title,
                                String artist,
                                Collection<String> titleAliases,
                                Collection<String> artistAliases) {
        String g = StringNormalizer.normalize(guess);
        if (g.isEmpty()) return GuessResult.WRONG;

        List<String> titles = normalizeAll(title, titleAliases);
        List<String> artists = normalizeAll(artist, artistAliases);

        for (String t : titles) {
            for (String a : artists) {
                if (t.isEmpty() || a.isEmpty()) continue;
                double s1 = SimilarityMatcher.getSimilarity(g, a + " " + t);
                double s2 = SimilarityMatcher.getSimilarity(g, t + " " + a);
                if (s1 >= THRESHOLD || s2 >= THRESHOLD) return GuessResult.BOTH;
            }
        }

        boolean titleHit = anyMatches(g, titles);
        boolean artistHit = anyMatches(g, artists);

        if (titleHit && artistHit) return GuessResult.BOTH;
        if (titleHit) return GuessResult.TITLE_ONLY;
        if (artistHit) return GuessResult.ARTIST_ONLY;
        return GuessResult.WRONG;
    }

    private List<String> normalizeAll(String primary, Collection<String> aliases) {
        List<String> out = new ArrayList<>();
        String p = StringNormalizer.normalize(primary);
        if (!p.isEmpty()) out.add(p);
        if (aliases != null) {
            for (String a : aliases) {
                String n = StringNormalizer.normalize(a);
                if (!n.isEmpty() && !out.contains(n)) out.add(n);
            }
        }
        return out;
    }

    private boolean anyMatches(String guess, List<String> candidates) {
        for (String c : candidates) {
            if (c.isEmpty()) continue;
            if (SimilarityMatcher.getSimilarity(guess, c) >= THRESHOLD) return true;
            if (containsPhrase(guess, c)) return true;
        }
        return false;
    }

    private boolean containsPhrase(String haystack, String needle) {
        if (needle.isEmpty()) return false;
        return (" " + haystack + " ").contains(" " + needle + " ");
    }
}
