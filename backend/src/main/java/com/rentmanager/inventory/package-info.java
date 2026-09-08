/**
 * Inventory (INTENT.md M15): stock items, two-level categories, suppliers, and
 * the append-only movement engine — the only way on-hand ever changes. Purchases
 * absorb cost at a moving average; sales / consumption / maintenance_use carry
 * stock out at that average; stocktakes post an {@code adjustment} movement for
 * every counted variance; transfers move quantity between two items of one
 * property. Quantities are integer milli (1 unit = 1000) and cost is minor×1000.
 *
 * <p>Also hosts <b>M14 POS</b> ({@code inventory.pos.*}): cash-drawer sessions
 * (open/close with expected-vs-counted variance), sales that decrement stock
 * through {@link com.rentmanager.inventory.service.StockService#applyStockSale},
 * and the "charge to room" path that issues a one-time member invoice via
 * {@link com.rentmanager.billing.BillingQueryApi#createOneTimeInvoice}. The
 * immediate cash/qr/card drawer posting is dependency-inverted through
 * {@link com.rentmanager.inventory.spi.PosLedgerPort} (finance implements it),
 * and the maintenance material-cost line (M19) through
 * {@link com.rentmanager.inventory.spi.MaintenanceCostPort} (no-op until M19),
 * so inventory never depends on finance/maintenance and the module graph stays
 * acyclic.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "properties", "billing" }
)
package com.rentmanager.inventory;
