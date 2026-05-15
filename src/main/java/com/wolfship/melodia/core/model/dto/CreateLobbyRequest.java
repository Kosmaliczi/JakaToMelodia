package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreateLobbyRequest(
        @NotBlank
        String playlistId,

        @Min(1) @Max(50)
        int totalRounds,

        /**
         * Nick hosta — gdy podany (niepusty), host dołącza do gry jako pierwszy
         * gracz z hotkeyem Q i ready=true. Walidacja długości po stronie serwisu
         * (bo pole opcjonalne — Bean Validation @Size traktuje null jako OK,
         * ale dziwnie współpracuje z pustym stringiem).
         */
        String hostName
) {}
