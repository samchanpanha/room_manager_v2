package com.rentmanager.leasing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

/** Mirrors createSchema in src/app/api/leases/route.ts. */
public record CreateLeaseRequest(
    @NotBlank String memberProfileId,
    @NotBlank String roomId,
    String bedId,
    @NotBlank String startDate,       // ISO-8601 datetime
    String endDate,
    @NotNull @DecimalMin("0") @DecimalMax("1000000") Double rentAmount,
    @Min(1) @Max(28) Integer billingCycleDay,
    @Pattern(regexp = "calendar|thirty_day") String prorationBasis,
    @DecimalMin("0") @DecimalMax("1000000") Double depositTotal,
    @Min(1) @Max(12) Integer depositInstallments,
    @Min(0) @Max(180) Integer noticeDays,
    Boolean autoRenew,
    @Min(0) @Max(50) Integer escalationPercent,
    @Valid List<LeaseServiceDto> services) {

  public int billingCycleDay() { return billingCycleDay == null ? 1 : billingCycleDay; }
  public String prorationBasis() { return prorationBasis == null ? "calendar" : prorationBasis; }
  public double depositTotal() { return depositTotal == null ? 0 : depositTotal; }
  public int depositInstallments() { return depositInstallments == null ? 1 : depositInstallments; }
  public int noticeDays() { return noticeDays == null ? 30 : noticeDays; }
  public boolean autoRenew() { return autoRenew != null && autoRenew; }
  public List<LeaseServiceDto> services() { return services == null ? List.of() : services; }
}
