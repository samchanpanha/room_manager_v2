package com.rentmanager.finance.dto;

import com.rentmanager.finance.domain.DepositTransaction;
import java.time.Instant;

/** Settlement movement view (M10). */
public record DepositTransactionDto(String id, String type, int amountMinor, String reason,
    String evidenceDocId, String note, String method) {

  public static DepositTransactionDto from(DepositTransaction t) {
    return new DepositTransactionDto(t.getId(), t.getType(), t.getAmountMinor(), t.getReason(),
        t.getEvidenceDocId(), t.getNote(), t.getMethod());
  }
}
