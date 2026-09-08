/**
 * Services (INTENT.md M12): the billable add-on catalog (WiFi / parking /
 * laundry / general), lease service assignments, parking-slot + WiFi-account
 * binding, and per-use entries. Billing integration keeps the module graph
 * acyclic through dependency inversion:
 * <ul>
 *   <li>fixed_monthly assignments write a lease {@code LeaseService} snapshot via
 *       {@link com.rentmanager.leasing.LeasingQueryApi} (window the rent engine
 *       prorates — mid-cycle suspend/end → prorated stop);</li>
 *   <li>per_use entries become pending rows folded into the next invoice through
 *       the billing-owned {@link com.rentmanager.billing.spi.ServiceUsageBillingPort}
 *       — implemented here by
 *       {@link com.rentmanager.services.spi.ServiceUsageBillingAdapter};</li>
 *   <li>on lease end, {@link com.rentmanager.services.spi.ServiceReleaseAdapter}
 *       implements the leasing {@link com.rentmanager.leasing.spi.ServiceReleasePort}
 *       to end assignments and release resources.</li>
 * </ul>
 * Depends on leasing/billing SPIs, never the reverse.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "leasing", "leasing :: spi", "billing :: spi" }
)
package com.rentmanager.services;
