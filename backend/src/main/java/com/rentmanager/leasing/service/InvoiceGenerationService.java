package com.rentmanager.leasing.service;

import com.rentmanager.billing.BillingQueryApi;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.domain.Lease;
import com.rentmanager.leasing.domain.LeaseRepository;
import com.rentmanager.leasing.domain.LeaseService;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.PropertyAccessApi;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monthly invoice generation job (INTENT.md M06/M07) — the leasing half of
 * {@code generateInvoices} in {@code src/lib/billing/service.tsx}. Leasing owns
 * lease state, so it selects the active leases and snapshots each one, then hands
 * composition + persistence to billing's {@link BillingQueryApi#generateForLease}
 * (billing owns the pricing engine). This keeps the module graph acyclic —
 * billing never depends on leasing.
 *
 * <p>Gate: M07:create. PROPERTY-scoped callers only generate for their assigned
 * properties; owners cannot run it.
 */
@Service
public class InvoiceGenerationService {

  private final LeaseRepository leases;
  private final MemberAccessApi members;
  private final PropertyAccessApi properties;
  private final BillingQueryApi billing;

  public InvoiceGenerationService(LeaseRepository leases, MemberAccessApi members,
      PropertyAccessApi properties, BillingQueryApi billing) {
    this.leases = leases;
    this.members = members;
    this.properties = properties;
    this.billing = billing;
  }

  public record GenerationSummary(int generated, int skipped,
      List<BillingQueryApi.GeneratedInvoice> invoices) {}

  @Transactional
  public GenerationSummary generate(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "create", "M07")) {
      throw ApiException.forbidden("M07", "create");
    }
    String tenantId = TenantContext.get();

    // GLOBAL callers generate for everyone; PROPERTY-scoped callers only for
    // their assigned properties. (Owners have no M07:create and are rejected.)
    List<Lease> active;
    if (Rbdc.can(user, "create", "M07")) {
      active = leases.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, "active");
    } else {
      List<String> scope = user.propertyIds();
      if (scope == null || scope.isEmpty()) {
        return new GenerationSummary(0, 0, List.of());
      }
      active = leases.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, "active").stream()
          .filter(l -> scope.contains(l.getPropertyId()))
          .toList();
    }

    List<BillingQueryApi.GeneratedInvoice> all = new ArrayList<>();
    for (Lease lease : active) {
      String propertyCode = properties.requireProperty(lease.getPropertyId()).code();
      String memberName = members.get(lease.getMemberProfileId()).name();

      List<BillingQueryApi.ServiceSnapshot> services = new ArrayList<>();
      for (LeaseService s : lease.getServices()) {
        services.add(new BillingQueryApi.ServiceSnapshot(s.getName(), s.getAmountMinor(),
            s.getPricingModel(), s.getActiveFrom(), s.getActiveThrough()));
      }

      BillingQueryApi.LeaseGenerationInput input = new BillingQueryApi.LeaseGenerationInput(
          lease.getId(), lease.getCode(), lease.getPropertyId(), propertyCode,
          lease.getMemberProfileId(), memberName, lease.getRentAmountMinor(),
          lease.getBillingCycleDay(), lease.getProrationBasis(), lease.getStartDate(), services);

      all.addAll(billing.generateForLease(input, user.id(), user.name()));
    }

    // "skipped" is implicit here — the per-lease call is idempotent and returns
    // only newly created invoices, so anything already billed is silently left.
    return new GenerationSummary(all.size(), 0, all);
  }
}
