package com.rentmanager.leasing;

import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.domain.Lease;
import com.rentmanager.leasing.domain.LeaseRepository;
import com.rentmanager.leasing.domain.LeaseService;
import com.rentmanager.leasing.domain.LeaseServiceRepository;
import com.rentmanager.platform.web.ApiException;
import java.time.Instant;
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
  private final LeaseServiceRepository leaseServices;

  public LeasingQueryApi(LeaseRepository leases, LeaseServiceRepository leaseServices) {
    this.leases = leases;
    this.leaseServices = leaseServices;
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

  // ---- LeaseService snapshots (M12 fixed_monthly billing) -----------------
  //
  // The services module (M12) drives fixed_monthly billing by writing a
  // LeaseService snapshot row (with an [activeFrom, activeThrough) window the
  // rent engine prorates). These helpers keep LeaseService entity mapping inside
  // the leasing module; the services module references snapshots only by id.

  /** Create a fixed_monthly billing snapshot on a lease; returns its id. */
  @Transactional
  public String createServiceSnapshot(String leaseId, String name, int amountMinor,
      Instant activeFrom) {
    String tenantId = TenantContext.get();
    LeaseService snapshot = new LeaseService(leaseId, name, amountMinor, "fixed_monthly",
        activeFrom, tenantId);
    return leaseServices.save(snapshot).getId();
  }

  /** Close a snapshot's billing window at {@code through} (mid-cycle suspend/end). */
  @Transactional
  public void closeServiceSnapshot(String snapshotId, Instant through) {
    if (snapshotId == null) return;
    leaseServices.findByIdAndTenantId(snapshotId, TenantContext.get())
        .ifPresent(s -> { s.setActiveThrough(through); leaseServices.save(s); });
  }
}
