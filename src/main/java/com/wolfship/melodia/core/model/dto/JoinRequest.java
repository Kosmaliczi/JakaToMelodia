package com.wolfship.melodia.core.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinRequest(
        @NotBlank(message = "Nick jest wymagany")
        @Size(min = 2, max = 20, message = "Nick musi mieć 2-20 znaków")
        String name
) {}
