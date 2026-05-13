package com.wolfship.melodia.shared.utils;

import org.apache.commons.text.similarity.LevenshteinDistance;

public class SimilarityMatcher {
    private static final LevenshteinDistance LEV = new LevenshteinDistance();

    public static double getSimilarity(String s1, String s2) {
        if (s1 == null || s2 == null || s1.isEmpty() || s2.isEmpty()) return 0.0;
        int dist = LEV.apply(s1, s2);
        return 1.0 - ((double) dist / Math.max(s1.length(), s2.length()));
    }
}