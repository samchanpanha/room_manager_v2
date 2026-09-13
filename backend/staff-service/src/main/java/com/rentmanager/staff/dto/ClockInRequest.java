package com.rentmanager.staff.dto;

import jakarta.validation.constraints.NotBlank;

public record ClockInRequest(
    @NotBlank(message = "User ID is required")
    String userId,
    @NotBlank(message = "Property ID is required")
    String propertyId,
    Double lat,
    Double lng,
    String source // kiosk | mobile | manual
) {}
