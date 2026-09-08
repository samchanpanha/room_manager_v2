/**
 * Billing (INTENT.md M07 invoices; M09 payments; M13 QR pay): invoices, invoice
 * items, credit notes, the invoice state machine and the issue/void/credit
 * lifecycle; the payment record/confirm/fail/refund lifecycle; and the M13 QR
 * sub-package ({@code billing.qrpay}) — dynamic per-invoice QR intents, the
 * signed member-token poster flow, the pluggable {@code QrProvider} adapter
 * (DevMock first) and the idempotent gateway webhook. Ledger postings (M08) are
 * delegated through the {@link com.rentmanager.billing.spi.LedgerPostingPort} SPI
 * so this module stays decoupled until the ledger module is ported.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "members", "properties" }
)
package com.rentmanager.billing;
