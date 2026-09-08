package com.rentmanager.finance.dto;

/** Deposit deduction (M10): amount is major-unit; evidence + note mandatory. */
public record DeductRequest(Double amount, String reason, String evidenceDocId, String note) {}
