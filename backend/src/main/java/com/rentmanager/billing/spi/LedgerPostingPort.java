package com.rentmanager.billing.spi;

/**
 * SPI seam to the accounting/ledger module (INTENT.md M08), which is not yet
 * ported. Billing calls these hooks on issue / void / credit so double-entry
 * postings happen when the ledger module registers a bean implementing this
 * port. Until then {@link NoopLedgerPosting} is the active bean and postings
 * are skipped (parity gap tracked in docs/backend-split-plan.md).
 */
public interface LedgerPostingPort {

  /** One aggregated invoice line (kind + net minor amount) for revenue splitting. */
  record InvoiceLine(String kind, int amountMinor) {}

  /**
   * Post the issue transaction (DR receivable / CR revenue by kind, tax → 2300)
   * for an invoice. {@code items} lets the ledger split revenue across accounts
   * and prorate the discount, matching the accrual-basis posting rules.
   */
  void onInvoiceIssued(String invoiceId, String propertyId, String memberProfileId,
      int totalMinor, int discountMinor, int taxMinor, java.util.List<InvoiceLine> items);

  /** Reverse all live postings when an invoice is voided. */
  void onInvoiceVoided(String invoiceId, String reason);

  /** Post a credit-note reversal (DR revenue / CR receivable) pro-rata. */
  void onCreditNoteIssued(String invoiceId, String propertyId, String memberProfileId,
      String noteCode, int amountMinor, String reason);

  /** Post a confirmed payment (DR cash/bank drawer / CR receivable). */
  void onPaymentConfirmed(String paymentId, String propertyId, String memberProfileId,
      String method, int amountMinor, String receiptCode);

  /** Post a refund of unallocated member credit (DR receivable / CR drawer). */
  void onPaymentRefunded(String paymentId, String propertyId, String memberProfileId,
      String method, int amountMinor, String reason);

  /** Post the deposit obligation (DR receivable / CR deposit liability). M10. */
  void onDepositBilled(String depositInvoiceId, String propertyId, String memberProfileId,
      int totalMinor);

  /**
   * Post a deposit deduction (DR deposit liability / CR revenue or receivable
   * depending on reason). Returns the ledger transaction id (or null when the
   * ledger module is not active). M10.
   */
  String onDepositDeducted(String depositId, String propertyId, String memberProfileId,
      int amountMinor, String reason);

  /** Post a deposit refund (DR deposit liability / CR cash/bank drawer). M10. */
  String onDepositRefunded(String depositId, String propertyId, String memberProfileId,
      int amountMinor, String method, String reason);
}
