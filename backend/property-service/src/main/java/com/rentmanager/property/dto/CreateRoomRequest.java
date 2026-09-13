package com.rentmanager.property.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreateRoomRequest(
    @NotBlank(message = "Floor ID is required")
    String floorId,
    @NotBlank(message = "Room number is required")
    String number,
    String type,
    @Min(value = 0, message = "Price cannot be negative")
    int basePriceMinor,
    @Min(value = 1, message = "Capacity must be at least 1")
    int capacity,
    String notes
) {}
