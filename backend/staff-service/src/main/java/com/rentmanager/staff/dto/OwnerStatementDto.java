package com.rentmanager.staff.dto;

import java.time.Instant;

public record OwnerStatementDto(
    String id,
    String code,
    String ownerProfileId,
    String contractId,
    String buildingId,
    String propertyId,
    String month,
    String status,
    int collectedMinor,
    int grossShareMinor,
    int managementFeeMinor,
    int netMinor,
    Instant createdAt
) {}
