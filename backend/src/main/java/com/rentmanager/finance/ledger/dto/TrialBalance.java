package com.rentmanager.finance.ledger.dto;

import java.util.List;

/** Trial balance (M08). */
public record TrialBalance(List<TrialBalanceRow> rows, long totalDebit, long totalCredit,
    boolean balanced) {}
