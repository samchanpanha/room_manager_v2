package com.rentmanager.property.dto;

import jakarta.validation.constraints.NotBlank;

public record CreatePropertyRequest(
    @NotBlank(message = "Code is required")
    String code,
    @NotBlank(message = "Name is required")
    String name,
    String address,
    Double geoLat,
    Double geoLng,
    Integer geofenceRadiusM
) {}
