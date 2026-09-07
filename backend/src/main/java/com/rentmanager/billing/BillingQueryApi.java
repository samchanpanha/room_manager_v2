package com.rentmanager.billing;

import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.kernel.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published billing API (INTENT.md M07) consumed by other modules — currently
 * the leasing module's move-out open-dues gate. Base-package placement makes it
 * the module's supported cross-module surface under Spring Modulith.
 */
@Service
public class BillingQueryApi {

  private final InvoiceRepository invoices;

  public BillingQueryApi(InvoiceRepository invoices) {
    this.invoices = invoices;
  }

  /** Sum of outstanding dues (minor units) across a member's live invoices. */
  @Transactional(readOnly = true)
  public long openDuesForMember(String memberProfileId) {
    return invoices.sumOpenDuesForMember(TenantContext.get(), memberProfileId);
  }

  /** Whether the member has any unpaid balance blocking move-out (M05 gate). */
  @Transactional(readOnly = true)
  public boolean hasOpenDues(String memberProfileId) {
    return openDuesForMember(memberProfileId) > 0;
  }
}
