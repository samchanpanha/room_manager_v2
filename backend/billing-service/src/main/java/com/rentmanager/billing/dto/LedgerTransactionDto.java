package com.rentmanager.billing.dto;

import java.time.Instant;

public record LedgerTransactionDto(
    String id,
    Instant postedAt,
    String memo,
    String refType,
    String refId,
    String propertyId,
    String memberId,
    int totalDebit,
    int totalCredit,
    Instant createdAt
) {}
