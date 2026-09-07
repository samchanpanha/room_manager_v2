package com.rentmanager.billing.spi;

/**
 * SPI seam to the accounting/ledger module (INTENT.md M08), which is not yet
 * ported. Billing calls these hooks on issue / void / credit so double-entry
 * postings happen when the ledger module registers a bean implementing this
 * port. Until then {@link NoopLedgerPosting} is the active bean and postings
 * are skipped (parity gap tracked in docs/backend-split-plan.md).
 */
public interface LedgerPostingPort {

  /** Post the issue transaction (DR receivable / CR revenue) for an invoice. */
  void onInvoiceIssued(String invoiceId, String propertyId, String memberProfileId, int totalMinor);

  /** Reverse all live postings when an invoice is voided. */
  void onInvoiceVoided(String invoiceId, String reason);

  /** Post a credit-note reversal (DR revenue / CR receivable) pro-rata. */
  void onCreditNoteIssued(String invoiceId, String noteCode, int amountMinor, String reason);
}
