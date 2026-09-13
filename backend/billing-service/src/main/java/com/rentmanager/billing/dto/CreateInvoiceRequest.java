package com.rentmanager.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public record CreateInvoiceRequest(
    @NotBlank(message = "Property ID is required")
    String propertyId,
    String leaseId,
    @NotBlank(message = "Member profile ID is required")
    String memberProfileId,
    @NotNull(message = "Period start is required")
    Instant periodStart,
    @NotNull(message = "Period end is required")
    Instant periodEnd,
    Instant dueDate,
    boolean isDeposit,
    List<ItemRequest> items
) {
    public record ItemRequest(
        @NotBlank String kind,
        @NotBlank String name,
        int qty,
        int unitMinor
    ) {}
}
