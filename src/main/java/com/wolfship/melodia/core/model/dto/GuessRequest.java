package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * playerId opcjonalny: dla single-device hosta wysyłany w body,
 * dla graczy z JWT brany z tokenu (pole ignorowane).
 */
public record GuessRequest(
        String playerId,
        @NotBlank String userText
) {}
