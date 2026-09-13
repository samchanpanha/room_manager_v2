package com.rentmanager.billing.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record CreateLeaseRequest(
    @NotBlank(message = "Member profile ID is required")
    String memberProfileId,
    @NotBlank(message = "Room ID is required")
    String roomId,
    @NotBlank(message = "Property ID is required")
    String propertyId,
    @NotNull(message = "Start date is required")
    Instant startDate,
    Instant endDate,
    @Min(value = 0, message = "Rent amount must be non-negative")
    int rentAmountMinor,
    @Min(value = 0, message = "Deposit total must be non-negative")
    int depositTotalMinor
) {}
