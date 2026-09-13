package com.rentmanager.ops.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateTicketStatusRequest(
    @NotBlank(message = "Status is required")
    String status,
    String assignedToId,
    String resolutionNote
) {}
