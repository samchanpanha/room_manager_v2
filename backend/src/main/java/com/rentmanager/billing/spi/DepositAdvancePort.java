package com.rentmanager.billing.spi;

/**
 * SPI seam to the finance/deposits module (INTENT.md M10). When a payment is
 * confirmed against a deposit invoice, billing calls this hook so the deposit's
 * status can advance (billed → held). The finance module registers the real
 * bean; until then {@link NoopDepositAdvance} is active and the call is a no-op.
 */
public interface DepositAdvancePort {

  /** A payment was applied to (part of) a deposit invoice — refresh its deposit. */
  void onDepositInvoicePaid(String invoiceId);
}
