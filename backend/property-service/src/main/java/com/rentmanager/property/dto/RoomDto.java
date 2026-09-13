package com.rentmanager.property.dto;

import java.time.Instant;

public record RoomDto(
    String id,
    String floorId,
    String number,
    String type,
    String status,
    int basePriceMinor,
    int capacity,
    String notes,
    Instant createdAt,
    Instant updatedAt
) {}
