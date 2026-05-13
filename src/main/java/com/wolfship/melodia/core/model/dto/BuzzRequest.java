package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.NotBlank;

public record BuzzRequest(@NotBlank String playerId) {}
