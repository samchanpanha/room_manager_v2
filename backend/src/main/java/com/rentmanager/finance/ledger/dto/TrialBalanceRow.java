package com.rentmanager.finance.ledger.dto;

/** One trial-balance row (M08): balance normalized to the account's normal side. */
public record TrialBalanceRow(String code, String name, String type,
    long debit, long credit, long balance) {}
