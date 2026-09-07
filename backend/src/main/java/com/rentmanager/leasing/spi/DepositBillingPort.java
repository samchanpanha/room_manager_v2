package com.rentmanager.leasing.spi;

/**
 * SPI seam to the finance/deposits module (INTENT.md M10). On lease activation,
 * leasing calls this so the deposit is created and billed as an installment
 * invoice. The finance module registers the real bean (dependency inversion —
 * leasing never imports finance); until then {@link NoopDepositBilling} is
 * active and lease activation simply notes that deposit billing is deferred.
 */
public interface DepositBillingPort {

  /** Result of trying to bill a lease's deposit. */
  record DepositBilled(boolean created, String invoiceCode) {}

  /**
   * Ensure a deposit exists for the lease and bill it (idempotent per lease).
   * Returns null when the lease has no deposit terms or the port is the no-op.
   */
  DepositBilled ensureDepositForLease(String leaseId);
}
