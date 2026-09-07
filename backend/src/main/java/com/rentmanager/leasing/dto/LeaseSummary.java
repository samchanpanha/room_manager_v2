package com.rentmanager.leasing.dto;

import com.rentmanager.leasing.domain.Lease;

public record LeaseSummary(
    String id,
    String code,
    String status,
    String memberProfileId,
    String roomId,
    String bedId,
    String propertyId,
    int rentAmountMinor,
    String startDate,
    String endDate,
    String nextBillingDate) {

  public static LeaseSummary from(Lease l) {
    return new LeaseSummary(l.getId(), l.getCode(), l.getStatus(), l.getMemberProfileId(),
        l.getRoomId(), l.getBedId(), l.getPropertyId(), l.getRentAmountMinor(),
        l.getStartDate() == null ? null : l.getStartDate().toString(),
        l.getEndDate() == null ? null : l.getEndDate().toString(),
        l.getNextBillingDate() == null ? null : l.getNextBillingDate().toString());
  }
}
