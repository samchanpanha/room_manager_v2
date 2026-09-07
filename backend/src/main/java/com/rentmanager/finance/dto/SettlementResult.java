package com.rentmanager.finance.dto;

/** Result of a deduction/refund movement (M10). */
public record SettlementResult(int remainingMinor, String status) {}
