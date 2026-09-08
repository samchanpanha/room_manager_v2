package com.rentmanager.utilities.spi;

import com.rentmanager.billing.spi.UtilityBillingPort;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.utilities.domain.Meter;
import com.rentmanager.utilities.domain.UtilityCharge;
import com.rentmanager.utilities.domain.UtilityRepositories;
import com.rentmanager.utilities.service.UtilityRules;
import java.util.List;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Utilities-side implementation of the billing {@link UtilityBillingPort} SPI
 * (INTENT.md M11 ↔ M06). Dependency is inverted: billing owns the port and
 * this {@code @Primary} bean supersedes {@code NoopUtilityBilling}, so the
 * generation engine folds a lease's pending utility charges into its next
 * invoice and reverts them if that invoice is voided — without billing ever
 * importing the utilities module.
 */
@Service
@Primary
public class UtilityBillingAdapter implements UtilityBillingPort {

  private final UtilityRepositories.Charges charges;
  private final UtilityRepositories.Meters meters;

  public UtilityBillingAdapter(UtilityRepositories.Charges charges,
      UtilityRepositories.Meters meters) {
    this.charges = charges;
    this.meters = meters;
  }

  @Override
  @Transactional(readOnly = true)
  public List<PendingCharge> pendingForLease(String leaseId) {
    String tenantId = TenantContext.get();
    return charges.findByLeaseIdAndStatusAndTenantId(leaseId, "pending", tenantId).stream()
        .sorted(java.util.Comparator.comparing(UtilityCharge::getPeriodEnd))
        .map(c -> new PendingCharge(c.getId(), "utility", lineLabel(c, tenantId), c.getAmountMinor()))
        .toList();
  }

  @Override
  @Transactional
  public void markBilled(List<String> chargeIds, String invoiceId) {
    String tenantId = TenantContext.get();
    for (String id : chargeIds) {
      charges.findByIdAndTenantId(id, tenantId)
          .filter(c -> "pending".equals(c.getStatus()))
          .ifPresent(c -> { c.markBilled(invoiceId, null); charges.save(c); });
    }
  }

  @Override
  @Transactional
  public void revertForInvoice(String invoiceId) {
    String tenantId = TenantContext.get();
    for (UtilityCharge c : charges.findByInvoiceIdAndTenantId(invoiceId, tenantId)) {
      if ("billed".equals(c.getStatus())) {
        c.revertToPending();
        charges.save(c);
      }
    }
  }

  private String lineLabel(UtilityCharge c, String tenantId) {
    Meter meter = meters.findByIdAndTenantId(c.getMeterId(), tenantId).orElse(null);
    String type = meter != null ? meter.getType() : "elec";
    String code = meter != null ? meter.getCode() : c.getMeterId();
    String unit = meter != null ? meter.getUnitLabel() : "";
    return UtilityRules.chargeLabel(type, code, c.getConsumptionMilli(), unit, c.isAnomaly());
  }
}
