package com.rentmanager.billing.dto;

public record InvoiceItemDto(
    String id,
    String kind,
    String name,
    int qty,
    int unitMinor,
    int amountMinor
) {}
