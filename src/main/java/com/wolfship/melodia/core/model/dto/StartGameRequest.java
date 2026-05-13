package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record StartGameRequest(
        @NotEmpty
        @Size(min = 2, max = 4, message = "Liczba graczy musi być w zakresie 2-4")
        List<@NotBlank String> playerNames,

        @NotBlank
        String playlistId,

        @Min(1) @Max(50)
        int totalRounds
) {}
