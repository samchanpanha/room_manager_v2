/**
 * Billing (INTENT.md M07 invoices; M09 payments, M13 QR pay land here later):
 * invoices, invoice items, credit notes, the invoice state machine and the
 * issue/void/credit lifecycle. Ledger postings (M08) are delegated through the
 * {@link com.rentmanager.billing.spi.LedgerPostingPort} SPI so this module stays
 * decoupled until the ledger module is ported.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "members", "properties" }
)
package com.rentmanager.billing;
