package com.rentmanager.billing.spi;

import java.util.List;

/**
 * SPI seam to the services module (INTENT.md M12). During generation billing
 * asks for a lease's pending per-use service entries and folds them into the
 * invoice as one-time {@code service} lines, then reports which were billed so
 * the services module can flip them {@code pending → billed}. On void the
 * entries are reverted. Dependency is inverted: billing owns the port, the
 * services module registers the real bean; until then {@link NoopServiceUsageBilling}
 * is active and generation adds no per-use lines.
 */
public interface ServiceUsageBillingPort {

  /** A pending per-use entry ready to bill: stable id + display line + amount. */
  record PendingUsage(String usageId, String kind, String name, int amountMinor) {}

  /** Pending (unbilled) per-use entries for a lease, oldest first. */
  List<PendingUsage> pendingForLease(String leaseId);

  /** Mark the given entries billed against an issued invoice (pending → billed). */
  void markBilled(List<String> usageIds, String invoiceId);

  /** Revert every per-use entry attached to a voided invoice back to pending. */
  void revertForInvoice(String invoiceId);
}
