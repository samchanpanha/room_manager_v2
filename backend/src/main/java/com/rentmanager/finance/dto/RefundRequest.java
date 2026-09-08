package com.rentmanager.finance.dto;

/** Deposit refund (M10): null amount → full remainder; note mandatory. */
public record RefundRequest(Double amount, String method, String note) {}
