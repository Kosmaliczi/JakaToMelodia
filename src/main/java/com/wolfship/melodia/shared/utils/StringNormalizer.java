package com.wolfship.melodia.shared.utils;

import java.text.Normalizer;
import java.util.regex.Pattern;

public class StringNormalizer {
    private static final Pattern NO_NO_ZONE = Pattern.compile("\\(.*?\\)|\\[.*?\\]|\\b(feat|ft|with|prod)\\b.*", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final Pattern CLEAN_CHARS = Pattern.compile("[^a-zA-Z0-9\\s]");

    public static String normalize(String input) {
        if (input == null) return "";
        String result = NO_NO_ZONE.matcher(input.toLowerCase()).replaceAll("");
        result = stripDiacritics(result);
        result = result.replace('ł', 'l');
        result = CLEAN_CHARS.matcher(result).replaceAll("");
        return result.trim().replaceAll("\\s{2,}", " ");
    }

    private static String stripDiacritics(String input) {
        String decomposed = Normalizer.normalize(input, Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed).replaceAll("");
    }
}
