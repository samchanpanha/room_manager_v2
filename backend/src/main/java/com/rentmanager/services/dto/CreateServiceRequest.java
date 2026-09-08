package com.rentmanager.services.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Mirrors the zod schema in src/app/api/services/route.ts. */
public record CreateServiceRequest(
    @NotBlank @Size(min = 2, max = 20) String code,
    @NotBlank @Size(min = 2, max = 80) String name,
    @NotBlank @Size(min = 3) String pricingModel,
    double price,
    @Size(max = 20) String unitLabel) {}
