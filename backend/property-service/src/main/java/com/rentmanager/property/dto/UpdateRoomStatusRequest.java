package com.rentmanager.property.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateRoomStatusRequest(
    @NotBlank(message = "Status is required")
    String status,
    String reason
) {}
