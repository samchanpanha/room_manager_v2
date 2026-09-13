package com.rentmanager.billing.dto;

import java.time.Instant;

public record LeaseDto(
    String id,
    String code,
    String memberProfileId,
    String roomId,
    String propertyId,
    String status,
    Instant startDate,
    Instant endDate,
    int rentAmountMinor,
    int billingCycleDay,
    int depositTotalMinor,
    Instant createdAt
) {}
