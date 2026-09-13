package com.rentmanager.staff.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record CreateExpenseRequest(
    @NotBlank(message = "Property ID is required")
    String propertyId,
    @NotBlank(message = "Category ID is required")
    String categoryId,
    @NotBlank(message = "Vendor name is required")
    String vendorName,
    String description,
    Instant expenseDate,
    @Min(value = 1, message = "Amount must be greater than 0")
    int amountMinor,
    @NotBlank(message = "Paid via method is required")
    String paidVia // cash | bank_transfer
) {}
