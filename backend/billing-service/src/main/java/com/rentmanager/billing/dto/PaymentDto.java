package com.rentmanager.billing.dto;

import java.time.Instant;

public record PaymentDto(
    String id,
    String code,
    String memberProfileId,
    String propertyId,
    String method,
    String status,
    int amountMinor,
    int remainingMinor,
    String receiptCode,
    Instant receivedAt,
    Instant createdAt
) {}
