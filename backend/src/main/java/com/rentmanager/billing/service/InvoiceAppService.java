package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.CreditNote;
import com.rentmanager.billing.domain.CreditNoteRepository;
import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceItem;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.dto.CreateInvoiceItemInput;
import com.rentmanager.billing.dto.CreateInvoiceRequest;
import com.rentmanager.billing.dto.CreditNoteRequest;
import com.rentmanager.billing.dto.InvoiceDetail;
import com.rentmanager.billing.dto.InvoiceSummary;
import com.rentmanager.billing.spi.LedgerPostingPort;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.PropertyAccessApi;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invoice use-cases (INTENT.md M07) — published API of the billing module.
 * Ports {@code src/lib/billing/service.tsx} + the {@code /api/invoices} routes:
 * manual draft creation, issue (allocate code + ledger post), void (reverse),
 * and credit notes. Amount recomputation keeps subtotal/total/amountDue in sync
 * with the item lines, payments and credits, exactly as the Next engine does.
 * Ledger side-effects are delegated to {@link LedgerPostingPort} (M08 SPI).
 */
@Service
public class InvoiceAppService {

  private final InvoiceRepository invoices;
  private final CreditNoteRepository creditNotes;
  private final NumberingService numbering;
  private final AuditService audit;
  private final MemberAccessApi membersApi;
  private final PropertyAccessApi propertiesApi;
  private final LedgerPostingPort ledger;
  private final com.rentmanager.billing.spi.UtilityBillingPort utilities;
  private final com.rentmanager.billing.spi.ServiceUsageBillingPort serviceUsages;

  public InvoiceAppService(InvoiceRepository invoices, CreditNoteRepository creditNotes,
      NumberingService numbering, AuditService audit, MemberAccessApi membersApi,
      PropertyAccessApi propertiesApi, LedgerPostingPort ledger,
      com.rentmanager.billing.spi.UtilityBillingPort utilities,
      com.rentmanager.billing.spi.ServiceUsageBillingPort serviceUsages) {
    this.invoices = invoices;
    this.creditNotes = creditNotes;
    this.numbering = numbering;
    this.audit = audit;
    this.membersApi = membersApi;
    this.propertiesApi = propertiesApi;
    this.ledger = ledger;
    this.utilities = utilities;
    this.serviceUsages = serviceUsages;
  }

  public record CreditNoteResult(String code, String invoiceStatus) {}

  private static int toMinor(Double major) {
    return major == null ? 0 : (int) Math.round(major * 100);
  }

  // ---- list / get ---------------------------------------------------------

  @Transactional(readOnly = true)
  public List<InvoiceSummary> list(AuthPrincipal user, String status, String propertyId) {
    String scope = Rbdc.widestScope(user, "read", "M07");
    if (scope == null) throw ApiException.forbidden("M07", "read");
    String tenantId = TenantContext.get();

    List<Invoice> rows;
    if ("GLOBAL".equals(scope)) {
      rows = invoices.search(tenantId, status, propertyId);
    } else if ("PROPERTY".equals(scope)) {
      if (user.propertyIds().isEmpty()) return List.of();
      rows = invoices.search(tenantId, status, propertyId).stream()
          .filter(i -> user.propertyIds().contains(i.getPropertyId()))
          .toList();
    } else {
      return List.of(); // OWN scope resolves through the tenant portal
    }
    return rows.stream().map(InvoiceSummary::from).toList();
  }

  @Transactional(readOnly = true)
  public InvoiceDetail get(AuthPrincipal user, String id) {
    Invoice invoice = load(id);
    requireRead(user, invoice);
    return InvoiceDetail.from(invoice);
  }

  // ---- create draft -------------------------------------------------------

  @Transactional
  public InvoiceDetail createDraft(AuthPrincipal user, CreateInvoiceRequest req) {
    if (req.propertyId() == null || req.propertyId().isBlank()) {
      throw new ApiException(400, "PROPERTY_REQUIRED", "propertyId is required");
    }
    if (!Rbdc.can(user, "create", "M07", Rbdc.ResourceRef.property(req.propertyId()))
        && !Rbdc.can(user, "create", "M07")) {
      throw ApiException.forbidden("M07", "create");
    }
    // Referential guards (parity with the Next route).
    propertiesApi.requireProperty(req.propertyId());
    MemberAccessApi.MemberInfo member = membersApi.get(req.memberProfileId());

    if (req.items() == null || req.items().isEmpty()) {
      throw new ApiException(400, "NO_ITEMS", "A draft invoice needs at least one line item");
    }
    Instant periodStart = Instant.parse(req.periodStart());
    Instant periodEnd = Instant.parse(req.periodEnd());
    if (!periodEnd.isAfter(periodStart)) {
      throw new ApiException(400, "INVALID_PERIOD", "periodEnd must be after periodStart");
    }
    boolean isDeposit = Boolean.TRUE.equals(req.isDeposit());
    String tenantId = TenantContext.get();

    // Uniqueness of live invoices per (leaseId, periodStart) — voided periods
    // are re-billable, so only non-void rows count (§M07).
    if (req.leaseId() != null && !isDeposit) {
      boolean clash = invoices.search(tenantId, null, req.propertyId()).stream()
          .anyMatch(i -> req.leaseId().equals(i.getLeaseId())
              && !"void".equals(i.getStatus())
              && i.getPeriodStart().equals(periodStart));
      if (clash) {
        throw new ApiException(409, "PERIOD_EXISTS",
            "A live invoice already covers this lease period");
      }
    }

    Invoice invoice = new Invoice(numbering.next("INVOICE", n -> "INV-" + String.format("%04d", n)),
        req.propertyId(), member.id(), periodStart, periodEnd, tenantId);
    invoice.setLeaseId(req.leaseId());
    invoice.setDueDate(req.dueDate() != null ? Instant.parse(req.dueDate()) : null);
    invoice.setDiscountMinor(toMinor(req.discount()));
    invoice.setTaxMinor(toMinor(req.tax()));
    invoice.setDeposit(isDeposit);
    invoice.setNotes(req.notes());
    invoice.setCreatedById(user.id());
    for (CreateInvoiceItemInput line : req.items()) {
      if (!InvoiceMachine.isItemKind(line.kind())) {
        throw new ApiException(400, "INVALID_KIND", "Unknown item kind: " + line.kind());
      }
      int qty = line.qty() == null ? 1 : line.qty();
      invoice.getItems().add(new InvoiceItem(line.kind(), line.name(), qty, toMinor(line.unit()), tenantId));
    }
    invoice.recompute();
    invoices.save(invoice);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M07").action("create").entityType("invoice").entityId(invoice.getId())
        .summary("Draft invoice " + invoice.getCode() + " created (total "
            + money(invoice.getTotalMinor()) + ")")
        .build());
    return InvoiceDetail.from(invoice);
  }

  // ---- issue --------------------------------------------------------------

  @Transactional
  public InvoiceDetail issue(AuthPrincipal user, String id) {
    Invoice invoice = load(id);
    requireUpdate(user, invoice);
    if (!InvoiceMachine.canTransition(invoice.getStatus(), "issued")) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot issue a " + invoice.getStatus() + " invoice");
    }
    invoice.setStatus("issued");
    invoice.setIssuedAt(Instant.now());
    if (invoice.getDueDate() == null) invoice.setDueDate(Instant.now());
    invoice.recompute();
    invoices.save(invoice);

    // M08 ledger post (DR receivable / CR revenue by kind, tax → 2300) via SPI.
    ledger.onInvoiceIssued(invoice.getId(), invoice.getPropertyId(),
        invoice.getMemberProfileId(), invoice.getTotalMinor(),
        invoice.getDiscountMinor(), invoice.getTaxMinor(),
        invoice.getItems().stream()
            .map(it -> new LedgerPostingPort.InvoiceLine(it.getKind(), it.getAmountMinor()))
            .toList());

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M07").action("update").entityType("invoice_status").entityId(id)
        .summary("Invoice " + invoice.getCode() + " issued (total " + money(invoice.getTotalMinor()) + ")")
        .before("{\"status\":\"draft\"}").after("{\"status\":\"issued\"}")
        .build());
    return InvoiceDetail.from(invoice);
  }

  // ---- void ---------------------------------------------------------------

  @Transactional
  public void voidInvoice(AuthPrincipal user, String id, String reason) {
    if (reason == null || reason.trim().length() < 3) {
      throw new ApiException(400, "REASON_REQUIRED", "A void reason (>=3 chars) is mandatory");
    }
    Invoice invoice = load(id);
    if (!Rbdc.can(user, "void", "M07", Rbdc.ResourceRef.property(invoice.getPropertyId()))
        && !Rbdc.can(user, "void", "M07")) {
      throw ApiException.forbidden("M07", "void");
    }
    if (!InvoiceMachine.canTransition(invoice.getStatus(), "void")) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot void a " + invoice.getStatus() + " invoice");
    }
    String prior = invoice.getStatus();
    invoice.setStatus("void");
    invoice.setVoidReason(reason);
    invoice.setVoidedAt(Instant.now());
    invoice.setAmountDueMinor(0);
    invoices.save(invoice);

    // M08 reversal via SPI.
    ledger.onInvoiceVoided(invoice.getId(), reason);
    // M11/M12 — release any utility charges + per-use service entries billed on
    // this invoice back to pending so they re-attach to the next generated invoice.
    utilities.revertForInvoice(invoice.getId());
    serviceUsages.revertForInvoice(invoice.getId());

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M07").action("void").entityType("invoice").entityId(id)
        .summary("Invoice " + invoice.getCode() + " voided: " + reason)
        .before("{\"status\":\"" + prior + "\"}").after("{\"status\":\"void\"}")
        .build());
  }

  // ---- credit note --------------------------------------------------------

  @Transactional
  public CreditNoteResult createCreditNote(AuthPrincipal user, String id, CreditNoteRequest req) {
    Invoice invoice = load(id);
    requireUpdate(user, invoice);
    if (!List.of("issued", "partial_paid", "overdue").contains(invoice.getStatus())) {
      throw new ApiException(400, "INVALID_STATUS",
          "Credit notes apply to open invoices (current: " + invoice.getStatus() + ")");
    }
    int amountMinor = toMinor(req.amount());
    if (amountMinor <= 0) {
      throw new ApiException(400, "INVALID_AMOUNT", "Credit amount must be positive");
    }
    if (amountMinor > invoice.getAmountDueMinor()) {
      throw new ApiException(422, "EXCEEDS_DUE",
          "Credit exceeds outstanding due (" + money(invoice.getAmountDueMinor()) + ")");
    }
    if (req.reason() == null || req.reason().trim().length() < 3) {
      throw new ApiException(400, "REASON_REQUIRED", "A credit reason (>=3 chars) is mandatory");
    }
    String tenantId = TenantContext.get();

    String code = numbering.next("CREDITNOTE", n -> "CN-" + String.format("%04d", n));
    creditNotes.save(new CreditNote(code, invoice.getId(), amountMinor, req.reason(), user.id(), tenantId));

    // The issued document stays immutable (§9.3): credits reduce the amount due
    // via amountCreditedMinor, they do not rewrite invoice items.
    invoice.setAmountCreditedMinor(invoice.getAmountCreditedMinor() + amountMinor);
    invoice.recompute();
    if (invoice.getAmountDueMinor() == 0 && InvoiceMachine.canTransition(invoice.getStatus(), "paid")) {
      invoice.setStatus("paid");
    }
    invoices.save(invoice);

    ledger.onCreditNoteIssued(invoice.getId(), invoice.getPropertyId(),
        invoice.getMemberProfileId(), code, amountMinor, req.reason());

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M07").action("update").entityType("credit_note").entityId(id)
        .summary("Credit note " + code + " (" + money(amountMinor) + ") on " + invoice.getCode()
            + ": " + req.reason() + ("paid".equals(invoice.getStatus()) ? " — invoice settled" : ""))
        .build());
    return new CreditNoteResult(code, invoice.getStatus());
  }

  // ---- helpers ------------------------------------------------------------

  private Invoice load(String id) {
    return invoices.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Invoice not found"));
  }

  private void requireRead(AuthPrincipal user, Invoice invoice) {
    if (!Rbdc.can(user, "read", "M07", Rbdc.ResourceRef.property(invoice.getPropertyId()))
        && !Rbdc.can(user, "read", "M07")) {
      throw ApiException.forbidden("M07", "read");
    }
  }

  private void requireUpdate(AuthPrincipal user, Invoice invoice) {
    if (!Rbdc.can(user, "update", "M07", Rbdc.ResourceRef.property(invoice.getPropertyId()))
        && !Rbdc.can(user, "update", "M07")) {
      throw ApiException.forbidden("M07", "update");
    }
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }
}
