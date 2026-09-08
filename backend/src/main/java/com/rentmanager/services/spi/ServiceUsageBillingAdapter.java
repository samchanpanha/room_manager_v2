package com.rentmanager.services.spi;

import com.rentmanager.billing.spi.ServiceUsageBillingPort;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.services.domain.ServiceCatalog;
import com.rentmanager.services.domain.ServiceRepositories;
import com.rentmanager.services.domain.ServiceUsage;
import com.rentmanager.services.service.ServiceRules;
import java.util.Comparator;
import java.util.List;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Services-side implementation of the billing {@link ServiceUsageBillingPort}
 * SPI (INTENT.md M12 ↔ M06). This {@code @Primary} bean supersedes
 * {@code NoopServiceUsageBilling}, so the generation engine folds a lease's
 * pending per-use entries into its next invoice as one-time {@code service}
 * lines and reverts them if that invoice is voided — without billing importing
 * the services module.
 */
@Service
@Primary
public class ServiceUsageBillingAdapter implements ServiceUsageBillingPort {

  private final ServiceRepositories.Usages usages;
  private final ServiceRepositories.Catalog catalog;

  public ServiceUsageBillingAdapter(ServiceRepositories.Usages usages,
      ServiceRepositories.Catalog catalog) {
    this.usages = usages;
    this.catalog = catalog;
  }

  @Override
  @Transactional(readOnly = true)
  public List<PendingUsage> pendingForLease(String leaseId) {
    String tenantId = TenantContext.get();
    return usages.findByLeaseIdAndStatusAndTenantId(leaseId, "pending", tenantId).stream()
        .sorted(Comparator.comparing(ServiceUsage::getUsedAt))
        .map(u -> new PendingUsage(u.getId(), "service", lineLabel(u, tenantId), u.amountMinor()))
        .toList();
  }

  @Override
  @Transactional
  public void markBilled(List<String> usageIds, String invoiceId) {
    String tenantId = TenantContext.get();
    for (String id : usageIds) {
      usages.findByIdAndTenantId(id, tenantId)
          .filter(u -> "pending".equals(u.getStatus()))
          .ifPresent(u -> { u.markBilled(invoiceId, null); usages.save(u); });
    }
  }

  @Override
  @Transactional
  public void revertForInvoice(String invoiceId) {
    String tenantId = TenantContext.get();
    for (ServiceUsage u : usages.findByInvoiceIdAndTenantId(invoiceId, tenantId)) {
      if ("billed".equals(u.getStatus())) {
        u.revertToPending();
        usages.save(u);
      }
    }
  }

  private String lineLabel(ServiceUsage u, String tenantId) {
    ServiceCatalog svc = catalog.findByIdAndTenantId(u.getServiceId(), tenantId).orElse(null);
    String name = svc != null ? svc.getName() : "Service";
    String unit = u.getUnitLabel() != null ? u.getUnitLabel() : "unit";
    return name + " — " + ServiceRules.formatMilli(u.getQtyMilli()) + " " + unit;
  }
}
