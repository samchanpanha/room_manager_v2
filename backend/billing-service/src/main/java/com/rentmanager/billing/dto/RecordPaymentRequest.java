package com.rentmanager.billing.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record RecordPaymentRequest(
    @NotBlank(message = "Member profile ID is required")
    String memberProfileId,
    String propertyId,
    @NotBlank(message = "Payment method is required")
    String method, // cash | bank_transfer | qr | card | cheque
    @Min(value = 1, message = "Payment amount must be greater than 0")
    int amountMinor,
    List<AllocationRequest> allocations
) {
    public record AllocationRequest(
        @NotBlank String invoiceId,
        @Min(value = 1) int amountMinor
    ) {}
}
