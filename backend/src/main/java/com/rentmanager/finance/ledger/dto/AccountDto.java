package com.rentmanager.finance.ledger.dto;

import com.rentmanager.finance.ledger.domain.LedgerAccount;

/** Chart-of-accounts row view (M08). */
public record AccountDto(String id, String code, String name, String type,
    boolean isSystem, boolean isActive) {

  public static AccountDto from(LedgerAccount a) {
    return new AccountDto(a.getId(), a.getCode(), a.getName(), a.getType(), a.isSystem(), a.isActive());
  }
}
