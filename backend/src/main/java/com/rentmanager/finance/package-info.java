/**
 * Finance (INTENT.md M10 deposits + M08 double-entry ledger; M20 expenses/P&L
 * land here later): security deposits, their installment billing,
 * hold/settlement lifecycle and deduction/refund movements, plus the accounting
 * ledger (chart of accounts, journal, trial balance, member statements).
 * Deposits are billed as {@code deposit}-kind invoices via the billing module's
 * published API and advanced when those invoices are paid. The ledger sub-module
 * ({@code finance.ledger}) implements the billing
 * {@link com.rentmanager.billing.spi.LedgerPostingPort} SPI, so every invoice /
 * payment / deposit event posts balanced double entries. This module implements
 * the deposit and ledger SPIs declared by leasing and billing (dependency
 * inversion — those modules never depend on finance).
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "members", "leasing", "leasing :: spi", "billing", "billing :: spi" }
)
package com.rentmanager.finance;
