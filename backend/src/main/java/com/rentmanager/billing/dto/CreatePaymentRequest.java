package com.rentmanager.billing.dto;

import java.util.List;

/**
 * Record a payment (M09). Amount/allocations are major-unit doubles here,
 * converted to integer minor units in the service, matching the Next API.
 * Allocations are optional — omitted means oldest-first auto-allocation.
 */
public record CreatePaymentRequest(
    String memberProfileId,
    String method,
    Double amount,
    List<AllocationInput> allocations,
    String idempotencyKey,
    String gatewayRef) {}
