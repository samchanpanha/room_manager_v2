package com.rentmanager.finance.dto;

import java.util.List;

/** Full deposit view including its settlement movements (M10). */
public record DepositDetail(DepositSummary deposit, List<DepositTransactionDto> transactions) {}
