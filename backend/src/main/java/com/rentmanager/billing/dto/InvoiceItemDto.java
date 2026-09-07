package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.InvoiceItem;

/** Line item view / input (M07). */
public record InvoiceItemDto(String id, String kind, String name, int qty,
    int unitMinor, int amountMinor) {

  public static InvoiceItemDto from(InvoiceItem i) {
    return new InvoiceItemDto(i.getId(), i.getKind(), i.getName(), i.getQty(),
        i.getUnitMinor(), i.getAmountMinor());
  }
}
