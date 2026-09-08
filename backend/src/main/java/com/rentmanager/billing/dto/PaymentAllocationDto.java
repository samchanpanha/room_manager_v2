package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.PaymentAllocation;

/** Allocation view (M09). */
public record PaymentAllocationDto(String id, String invoiceId, int amountMinor) {

  public static PaymentAllocationDto from(PaymentAllocation a) {
    return new PaymentAllocationDto(a.getId(), a.getInvoiceId(), a.getAmountMinor());
  }
}
