package com.rentmanager.finance.ledger.dto;

/** One posting line inside a journal/statement row (M08). */
public record JournalEntryDto(String code, String name, int debit, int credit, String memo) {}
