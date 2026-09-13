package com.rentmanager.property.dto;

import java.time.Instant;

public record PropertyDto(
    String id,
    String tenantId,
    String code,
    String name,
    String address,
    String status,
    Double geoLat,
    Double geoLng,
    Integer geofenceRadiusM,
    Instant createdAt,
    int buildingCount,
    int roomsTotal,
    int roomsOccupied
) {}
