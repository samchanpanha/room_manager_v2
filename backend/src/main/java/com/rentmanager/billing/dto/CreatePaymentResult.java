package com.rentmanager.billing.dto;

/** Result of recording a payment (M09). */
public record CreatePaymentResult(String paymentId, String code,
    int allocatedMinor, int remainderMinor, boolean deduplicated) {}
