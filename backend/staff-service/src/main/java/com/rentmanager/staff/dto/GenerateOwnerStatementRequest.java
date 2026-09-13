package com.rentmanager.staff.dto;

import jakarta.validation.constraints.NotBlank;

public record GenerateOwnerStatementRequest(
    @NotBlank(message = "Owner profile ID is required")
    String ownerProfileId,
    @NotBlank(message = "Contract ID is required")
    String contractId,
    @NotBlank(message = "Building ID is required")
    String buildingId,
    @NotBlank(message = "Property ID is required")
    String propertyId,
    @NotBlank(message = "Month YYYY-MM is required")
    String month,
    int collectedMinor,
    int grossShareMinor,
    int managementFeeMinor
) {}
