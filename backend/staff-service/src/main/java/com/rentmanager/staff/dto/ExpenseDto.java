package com.rentmanager.staff.dto;

import java.time.Instant;

public record ExpenseDto(
    String id,
    String code,
    String propertyId,
    String categoryId,
    String vendorName,
    String description,
    Instant expenseDate,
    int amountMinor,
    String paidVia,
    String status,
    boolean autoApproved,
    String submittedById,
    Instant createdAt
) {}
