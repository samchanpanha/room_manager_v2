/**
 * Finance (INTENT.md M10 deposits; M08 ledger, M20 expenses/P&L land here later):
 * security deposits, their installment billing, hold/settlement lifecycle and
 * deduction/refund movements. Deposits are billed as {@code deposit}-kind
 * invoices via the billing module's published API and advanced when those
 * invoices are paid; ledger postings (M08) are delegated through the billing
 * {@link com.rentmanager.billing.spi.LedgerPostingPort} SPI until the ledger is
 * ported. This module implements the deposit SPIs declared by leasing and
 * billing (dependency inversion — those modules never depend on finance).
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "leasing", "leasing :: spi", "billing", "billing :: spi" }
)
package com.rentmanager.finance;
