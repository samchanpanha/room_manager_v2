package com.rentmanager.finance.ledger.dto;

/** CI/live integrity probe (M08): Σ debits == Σ credits across the ledger. */
public record LedgerIntegrity(long totalDebit, long totalCredit, boolean balanced, long transactions) {}
