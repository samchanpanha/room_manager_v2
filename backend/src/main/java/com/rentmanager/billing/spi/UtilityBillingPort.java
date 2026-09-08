package com.rentmanager.billing.spi;

import java.util.List;

/**
 * SPI seam to the utilities module (INTENT.md M11). During generation billing
 * asks for a lease's pending utility charges and folds them into the invoice as
 * one-time {@code utility} lines, then reports which charges were billed so the
 * utilities module can flip them {@code pending → billed}. On void the charges
 * are reverted. Dependency is inverted: billing owns the port, the utilities
 * module registers the real bean; until then {@link NoopUtilityBilling} is
 * active and generation simply adds no utility lines.
 */
public interface UtilityBillingPort {

  /** A pending utility charge ready to bill: stable id + display line + amount. */
  record PendingCharge(String chargeId, String kind, String name, int amountMinor) {}

  /** Pending (unbilled) utility charges for a lease, oldest first. */
  List<PendingCharge> pendingForLease(String leaseId);

  /** Mark the given charges billed against an issued invoice (pending → billed). */
  void markBilled(List<String> chargeIds, String invoiceId);

  /** Revert every charge attached to a voided invoice back to pending. */
  void revertForInvoice(String invoiceId);
}
