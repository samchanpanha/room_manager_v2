/**
 * Inventory (INTENT.md M15): stock items, two-level categories, suppliers, and
 * the append-only movement engine — the only way on-hand ever changes. Purchases
 * absorb cost at a moving average; sales / consumption / maintenance_use carry
 * stock out at that average; stocktakes post an {@code adjustment} movement for
 * every counted variance; transfers move quantity between two items of one
 * property. Quantities are integer milli (1 unit = 1000) and cost is minor×1000.
 *
 * <p>The POS module (M14) decrements stock through the published
 * {@link com.rentmanager.inventory.service.StockService#applyStockSale}. The
 * maintenance material-cost line (M19) is dependency-inverted through
 * {@link com.rentmanager.inventory.spi.MaintenanceCostPort} (no-op until M19 is
 * ported), so inventory never depends on maintenance and the module graph stays
 * acyclic.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "properties" }
)
package com.rentmanager.inventory;
