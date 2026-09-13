package com.rentmanager.billing.dto;

import java.time.Instant;
import java.util.List;

public record InvoiceDto(
    String id,
    String code,
    String propertyId,
    String leaseId,
    String memberProfileId,
    String status,
    Instant periodStart,
    Instant periodEnd,
    Instant issuedAt,
    Instant dueDate,
    int subtotalMinor,
    int discountMinor,
    int taxMinor,
    int totalMinor,
    int amountPaidMinor,
    int amountDueMinor,
    boolean isDeposit,
    List<InvoiceItemDto> items,
    Instant createdAt
) {}
