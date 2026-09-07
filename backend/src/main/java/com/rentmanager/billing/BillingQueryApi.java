package com.rentmanager.billing;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceItem;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.service.RentEngineService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published billing API (INTENT.md M07) consumed by other modules — the leasing
 * move-out open-dues gate (M05) and the finance/deposits module (M10, which
 * bills deposit invoices and reads their collection facts). Base-package
 * placement makes it the module's supported cross-module surface under Spring
 * Modulith; the finance module depends on billing, never the reverse.
 */
@Service
public class BillingQueryApi {

  /** A deposit installment line requested by finance (M10). */
  public record DepositLine(String name, int amountMinor) {}

  /** A fixed-monthly lease service snapshot for rent-engine generation (M06). */
  public record ServiceSnapshot(String name, int amountMinor, String pricingModel,
      Instant activeFrom, Instant activeThrough) {}

  /** Everything billing needs to generate one active lease's pending invoices (M06). */
  public record LeaseGenerationInput(String leaseId, String leaseCode, String propertyId,
      String propertyCode, String memberProfileId, String memberName, int rentMinor,
      int billingCycleDay, String prorationBasis, Instant startDate,
      List<ServiceSnapshot> services) {}

  /** One generated invoice, echoed back to the leasing job for its summary (M06). */
  public record GeneratedInvoice(String id, String code, String leaseCode, int totalMinor,
      Instant periodStart, Instant periodEnd) {}

  /** Collection facts of an invoice needed to advance a deposit (M10). */
  public record InvoiceFacts(String id, String status, int totalMinor,
      int amountPaidMinor, boolean isDeposit, String leaseId) {}

  private final InvoiceRepository invoices;
  private final NumberingService numbering;
  private final RentEngineService rentEngine;

  public BillingQueryApi(InvoiceRepository invoices, NumberingService numbering,
      RentEngineService rentEngine) {
    this.invoices = invoices;
    this.numbering = numbering;
    this.rentEngine = rentEngine;
  }

  /**
   * Generate (compose + issue) the pending invoices for one active lease (M06).
   * Called by the leasing generation job, which owns lease state; billing owns
   * the pricing engine and persistence. Idempotent per (lease, period).
   */
  @Transactional
  public List<GeneratedInvoice> generateForLease(LeaseGenerationInput lease, String actorId,
      String actorName) {
    return rentEngine.generateForLease(lease, actorId, actorName);
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

  /** Collection facts for one invoice, or null when it is outside the tenant. */
  @Transactional(readOnly = true)
  public InvoiceFacts invoiceFacts(String invoiceId) {
    return invoices.findByIdAndTenantId(invoiceId, TenantContext.get())
        .map(i -> new InvoiceFacts(i.getId(), i.getStatus(), i.getTotalMinor(),
            i.getAmountPaidMinor(), i.isDeposit(), i.getLeaseId()))
        .orElse(null);
  }

  /**
   * Bill a deposit as an already-issued {@code deposit}-kind invoice with the
   * given installment lines (M10). Excluded from the billing-period chain
   * ({@code isDeposit=true}) and due at move-in so oldest-first allocation
   * collects it first. Returns the created invoice's facts (id + code + total).
   */
  @Transactional
  public InvoiceFacts billDepositInvoice(String propertyId, String leaseId, String memberProfileId,
      Instant dueDate, List<DepositLine> lines, String actorId) {
    String tenantId = TenantContext.get();
    // Deposit invoices sit outside every real billing period (§M10 sentinel).
    Instant sentinel = Instant.parse("2000-01-01T00:00:00Z");
    Invoice invoice = new Invoice(
        numbering.next("INVOICE", n -> "INV-" + String.format("%04d", n)),
        propertyId, memberProfileId, sentinel, sentinel, tenantId);
    invoice.setLeaseId(leaseId);
    invoice.setDeposit(true);
    invoice.setStatus("issued");
    invoice.setIssuedAt(Instant.now());
    invoice.setDueDate(dueDate);
    invoice.setCreatedById(actorId);
    for (DepositLine l : lines) {
      invoice.getItems().add(new InvoiceItem("deposit", l.name(), 1, l.amountMinor(), tenantId));
    }
    invoice.recompute();
    invoices.save(invoice);
    return new InvoiceFacts(invoice.getId(), invoice.getStatus(), invoice.getTotalMinor(),
        invoice.getAmountPaidMinor(), true, leaseId);
  }
}
