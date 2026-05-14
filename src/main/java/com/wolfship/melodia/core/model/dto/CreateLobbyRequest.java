package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreateLobbyRequest(
        @NotBlank
        String playlistId,

        @Min(1) @Max(50)
        int totalRounds
) {}
