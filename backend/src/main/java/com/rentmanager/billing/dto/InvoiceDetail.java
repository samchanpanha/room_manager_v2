package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.Invoice;
import java.util.List;

/** Full invoice view including its line items (M07). */
public record InvoiceDetail(InvoiceSummary invoice, List<InvoiceItemDto> items) {

  public static InvoiceDetail from(Invoice i) {
    return new InvoiceDetail(InvoiceSummary.from(i),
        i.getItems().stream().map(InvoiceItemDto::from).toList());
  }
}
