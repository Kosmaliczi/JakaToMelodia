package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.NotBlank;

public record GuessRequest(
        @NotBlank String playerId,
        @NotBlank String userText
) {}
