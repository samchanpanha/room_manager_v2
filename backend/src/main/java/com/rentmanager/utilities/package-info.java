/**
 * Utilities (INTENT.md M11): meters, readings (manual / estimate / CSV import),
 * tariffs (progressive tiers, property-specific or org-default) and the
 * consumption charge engine. Recording a reading computes consumption = reading
 * − previous, prices it with the effective tariff and, for a room's active
 * lease, records a {@code pending} {@link com.rentmanager.utilities.domain.UtilityCharge}.
 * Pending charges are folded into the lease's next invoice by the billing
 * generation engine (M06) via the billing-owned
 * {@link com.rentmanager.billing.spi.UtilityBillingPort} SPI — implemented here
 * by {@link com.rentmanager.utilities.spi.UtilityBillingAdapter} — and reverted
 * to pending when that invoice is voided. Dependency inversion keeps the module
 * graph acyclic: utilities depends on billing/leasing/properties, never the
 * reverse.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "properties", "leasing", "billing :: spi" }
)
package com.rentmanager.utilities;
