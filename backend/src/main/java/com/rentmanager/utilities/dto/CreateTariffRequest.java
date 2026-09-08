package com.rentmanager.utilities.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Mirrors the zod schema in src/app/api/tariffs/route.ts. {@code tiers} is an
 * optional JSON array of {@code {upToMilli, ratePerUnitMinor}}; a null
 * {@code propertyId} defines an organisation-wide default tariff.
 */
public record CreateTariffRequest(
    @NotBlank String utilityType,
    @NotBlank @Size(min = 2, max = 60) String name,
    String propertyId,
    Integer unitRateMinor,
    JsonNode tiers,
    Instant effectiveFrom) {}
