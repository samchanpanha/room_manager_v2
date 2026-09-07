package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.Payment;
import java.util.List;

/** Full payment view including its allocations (M09). */
public record PaymentDetail(PaymentSummary payment, List<PaymentAllocationDto> allocations) {

  public static PaymentDetail from(Payment p) {
    return new PaymentDetail(PaymentSummary.from(p),
        p.getAllocations().stream().map(PaymentAllocationDto::from).toList());
  }
}
