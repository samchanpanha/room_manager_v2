package com.rentmanager.billing.dto;

import com.rentmanager.billing.domain.Invoice;
import java.time.Instant;

/** List-row projection of an invoice (M07). */
public record InvoiceSummary(
    String id, String code, String propertyId, String leaseId, String memberProfileId,
    String status, Instant periodStart, Instant periodEnd, Instant issuedAt, Instant dueDate,
    int totalMinor, int amountPaidMinor, int amountCreditedMinor, int amountDueMinor,
    int dunningStage, boolean isDeposit) {

  public static InvoiceSummary from(Invoice i) {
    return new InvoiceSummary(i.getId(), i.getCode(), i.getPropertyId(), i.getLeaseId(),
        i.getMemberProfileId(), i.getStatus(), i.getPeriodStart(), i.getPeriodEnd(),
        i.getIssuedAt(), i.getDueDate(), i.getTotalMinor(), i.getAmountPaidMinor(),
        i.getAmountCreditedMinor(), i.getAmountDueMinor(), i.getDunningStage(), i.isDeposit());
  }
}
