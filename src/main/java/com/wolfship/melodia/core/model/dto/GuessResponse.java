package com.wolfship.melodia.core.model.dto;

import com.wolfship.melodia.core.model.GuessResult;

public record GuessResponse(
        GuessResult result,
        int pointsAwarded,
        GameStatusResponse status
) {}
