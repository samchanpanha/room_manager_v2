package com.rentmanager.finance.dto;

/** List-row projection of a deposit (M10) with computed money facts. */
public record DepositSummary(
    String id, String leaseId, String memberProfileId, String propertyId, String status,
    int requiredMinor, int collectedMinor, int deductedMinor, int refundedMinor,
    int remainingMinor, String invoiceId) {}
