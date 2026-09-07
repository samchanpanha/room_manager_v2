package com.rentmanager.owners.dto;

import com.rentmanager.owners.domain.OwnerProfile;
import java.util.List;

public record OwnerSummary(
    String id,
    String status,
    String companyName,
    List<PayoutSummary> payoutMethods) {

  public record PayoutSummary(String id, String kind, String accountName, boolean isPrimary) {}

  public static OwnerSummary from(OwnerProfile o) {
    return new OwnerSummary(o.getId(), o.getStatus(), o.getCompanyName(),
        o.getPayoutMethods().stream()
            .map(p -> new PayoutSummary(p.getId(), p.getKind(), p.getAccountName(), p.isPrimary()))
            .toList());
  }
}
