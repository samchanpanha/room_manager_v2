package com.rentmanager.ops.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTicketRequest(
    @NotBlank(message = "Property ID is required")
    String propertyId,
    String roomId,
    String leaseId,
    String memberProfileId,
    @NotBlank(message = "Category is required")
    String category, // plumbing | electrical | appliance | furniture | internet | other
    String priority, // low | medium | high | urgent
    @NotBlank(message = "Title is required")
    String title,
    @NotBlank(message = "Description is required")
    String description,
    String source
) {}
