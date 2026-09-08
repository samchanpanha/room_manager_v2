package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.Payment;
import java.time.Instant;

/** List-row / detail projection of a payment (M09). */
public record PaymentSummary(
    String id, String code, String memberProfileId, String propertyId, String method,
    String status, int amountMinor, int remainingMinor, int refundedMinor,
    String receiptCode, Instant receivedAt, Instant confirmedAt) {

  public static PaymentSummary from(Payment p) {
    return new PaymentSummary(p.getId(), p.getCode(), p.getMemberProfileId(), p.getPropertyId(),
        p.getMethod(), p.getStatus(), p.getAmountMinor(), p.getRemainingMinor(),
        p.getRefundedMinor(), p.getReceiptCode(), p.getReceivedAt(), p.getConfirmedAt());
  }
}
