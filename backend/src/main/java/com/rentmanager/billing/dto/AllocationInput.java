package com.rentmanager.billing.dto;

/** One requested allocation onto an invoice (M09); amount is major-unit. */
public record AllocationInput(String invoiceId, Double amount) {}
