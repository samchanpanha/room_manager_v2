package com.rentmanager.ops.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record CreateInspectionRequest(
    @NotBlank(message = "Inspection type is required")
    String type, // move_in | move_out | periodic
    @NotBlank(message = "Lease ID is required")
    String leaseId,
    @NotBlank(message = "Room ID is required")
    String roomId,
    @NotBlank(message = "Property ID is required")
    String propertyId,
    Instant scheduledAt
) {}
