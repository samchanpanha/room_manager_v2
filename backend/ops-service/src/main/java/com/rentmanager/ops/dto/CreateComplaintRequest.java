package com.rentmanager.ops.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateComplaintRequest(
    @NotBlank(message = "Property ID is required")
    String propertyId,
    @NotBlank(message = "Member profile ID is required")
    String memberProfileId,
    String leaseId,
    @NotBlank(message = "Category is required")
    String category,
    String priority,
    @NotBlank(message = "Subject is required")
    String subject,
    @NotBlank(message = "Description is required")
    String description
) {}
