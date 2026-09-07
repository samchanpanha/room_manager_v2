package com.rentmanager.billing.dto;

/** Credit-note creation (M07): amount is a positive major-unit value. */
public record CreditNoteRequest(Double amount, String reason) {}
