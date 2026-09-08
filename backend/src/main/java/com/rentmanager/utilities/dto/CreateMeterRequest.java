package com.rentmanager.utilities.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Mirrors the zod schema in src/app/api/meters/route.ts. */
public record CreateMeterRequest(
    @NotBlank @Size(min = 2, max = 30) String code,
    @NotBlank String type,
    @NotBlank String roomId,
    @Size(max = 10) String unitLabel) {}
