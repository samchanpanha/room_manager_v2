package com.rentmanager.leasing;

import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.domain.Lease;
import com.rentmanager.leasing.domain.LeaseRepository;
import com.rentmanager.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published leasing API (INTENT.md M05) consumed by other modules — the
 * finance/deposits module (M10) reads a lease's deposit terms and current status
 * to bill deposits and gate settlement movements. Base-package placement makes
 * this the module's supported cross-module surface; finance depends on leasing,
 * never the reverse.
 */
@Service
public class LeasingQueryApi {

  private final LeaseRepository leases;

  public LeasingQueryApi(LeaseRepository leases) {
    this.leases = leases;
  }

  /** Deposit-relevant snapshot of a lease. */
  public record LeaseInfo(String id, String code, String status, String propertyId,
      String memberProfileId, int depositTotalMinor, int depositInstallments,
      java.time.Instant startDate) {}

  @Transactional(readOnly = true)
  public LeaseInfo get(String leaseId) {
    Lease l = leases.findByIdAndTenantId(leaseId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Lease not found"));
    return new LeaseInfo(l.getId(), l.getCode(), l.getStatus(), l.getPropertyId(),
        l.getMemberProfileId(), l.getDepositTotalMinor(), l.getDepositInstallments(),
        l.getStartDate());
  }

  /** Whether a lease's status permits deposit settlement (move-out window). */
  @Transactional(readOnly = true)
  public boolean allowsSettlement(String leaseId) {
    String s = get(leaseId).status();
    return "notice".equals(s) || "completed".equals(s) || "terminated".equals(s);
  }

  /** The active lease for a room, if any — used by utilities (M11) to attach a
   *  computed charge to the resident's account. Returns null when the room is
   *  vacant. */
  @Transactional(readOnly = true)
  public LeaseInfo activeLeaseForRoom(String roomId) {
    return leases.findByRoomIdAndStatusAndTenantId(roomId, "active", TenantContext.get())
        .stream().findFirst()
        .map(l -> new LeaseInfo(l.getId(), l.getCode(), l.getStatus(), l.getPropertyId(),
            l.getMemberProfileId(), l.getDepositTotalMinor(), l.getDepositInstallments(),
            l.getStartDate()))
        .orElse(null);
  }
}
