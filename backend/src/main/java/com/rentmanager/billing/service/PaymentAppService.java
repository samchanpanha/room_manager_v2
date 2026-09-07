package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.domain.Payment;
import com.rentmanager.billing.domain.PaymentAllocation;
import com.rentmanager.billing.domain.PaymentRepository;
import com.rentmanager.billing.dto.AllocationInput;
import com.rentmanager.billing.dto.CreatePaymentRequest;
import com.rentmanager.billing.dto.CreatePaymentResult;
import com.rentmanager.billing.dto.PaymentDetail;
import com.rentmanager.billing.dto.PaymentSummary;
import com.rentmanager.billing.service.PaymentAllocator.Allocation;
import com.rentmanager.billing.service.PaymentAllocator.OpenInvoice;
import com.rentmanager.billing.spi.DepositAdvancePort;
import com.rentmanager.billing.spi.LedgerPostingPort;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payment use-cases (INTENT.md M09) — published API of the billing module.
 * Ports {@code src/lib/payments/service.tsx} + the {@code /api/payments} routes:
 * record (pending, oldest-first or explicit allocations, idempotent on
 * idempotencyKey), confirm (allocate receipt, apply allocations to invoices,
 * flip invoice status via amountPaid, post to the ledger), fail, and refund of
 * the unallocated remainder. Ledger side-effects go through
 * {@link LedgerPostingPort} (M08 SPI); no-op until the finance module is ported.
 */
@Service
public class PaymentAppService {

  private final PaymentRepository payments;
  private final InvoiceRepository invoices;
  private final NumberingService numbering;
  private final AuditService audit;
  private final MemberAccessApi membersApi;
  private final LedgerPostingPort ledger;
  private final DepositAdvancePort deposits;

  public PaymentAppService(PaymentRepository payments, InvoiceRepository invoices,
      NumberingService numbering, AuditService audit, MemberAccessApi membersApi,
      LedgerPostingPort ledger, DepositAdvancePort deposits) {
    this.payments = payments;
    this.invoices = invoices;
    this.numbering = numbering;
    this.audit = audit;
    this.membersApi = membersApi;
    this.ledger = ledger;
    this.deposits = deposits;
  }

  public record ConfirmResult(boolean ignored, String receiptCode, String paymentStatus) {}

  private static int toMinor(Double major) {
    return major == null ? 0 : (int) Math.round(major * 100);
  }

  private static int currentYear() {
    return ZonedDateTime.now(ZoneOffset.UTC).getYear();
  }

  // ---- list / get ---------------------------------------------------------

  @Transactional(readOnly = true)
  public List<PaymentSummary> list(AuthPrincipal user, String status, String method) {
    String scope = Rbdc.widestScope(user, "read", "M09");
    if (scope == null) throw ApiException.forbidden("M09", "read");
    String tenantId = TenantContext.get();

    List<Payment> rows = payments.search(tenantId, status, method);
    if ("GLOBAL".equals(scope)) {
      return rows.stream().map(PaymentSummary::from).toList();
    }
    if ("PROPERTY".equals(scope)) {
      if (user.propertyIds().isEmpty()) return List.of();
      return rows.stream()
          .filter(p -> p.getPropertyId() != null && user.propertyIds().contains(p.getPropertyId()))
          .map(PaymentSummary::from).toList();
    }
    return List.of(); // OWN scope resolves through the tenant portal
  }

  @Transactional(readOnly = true)
  public PaymentDetail get(AuthPrincipal user, String id) {
    Payment p = load(id);
    requireRead(user, p);
    return PaymentDetail.from(p);
  }

  // ---- create (pending) ---------------------------------------------------

  @Transactional
  public CreatePaymentResult create(AuthPrincipal user, CreatePaymentRequest req) {
    int amountMinor = toMinor(req.amount());
    if (amountMinor <= 0) {
      throw new ApiException(400, "INVALID_AMOUNT", "Payment amount must be positive");
    }
    if (!PaymentMachine.isMethod(req.method())) {
      throw new ApiException(400, "INVALID_METHOD", "Unknown payment method");
    }
    String tenantId = TenantContext.get();

    // Idempotency (§9.6): a repeat key returns the original payment untouched.
    if (req.idempotencyKey() != null) {
      var dup = payments.findByIdempotencyKeyAndTenantId(req.idempotencyKey(), tenantId);
      if (dup.isPresent()) {
        Payment p = dup.get();
        return new CreatePaymentResult(p.getId(), p.getCode(), p.allocatedMinor(),
            p.getRemainingMinor(), true);
      }
    }

    MemberAccessApi.MemberInfo member = membersApi.get(req.memberProfileId());
    if (!Rbdc.can(user, "create", "M09")
        && !(member.homePropertyId() != null
            && Rbdc.can(user, "create", "M09", Rbdc.ResourceRef.property(member.homePropertyId())))) {
      throw ApiException.forbidden("M09", "create");
    }

    List<Invoice> open = invoices.findOpenForMember(tenantId, member.id());
    Map<String, Invoice> openById = new HashMap<>();
    for (Invoice i : open) openById.put(i.getId(), i);

    List<Allocation> allocations;
    if (req.allocations() != null && !req.allocations().isEmpty()) {
      allocations = new ArrayList<>();
      for (AllocationInput a : req.allocations()) {
        allocations.add(new Allocation(a.invoiceId(), toMinor(a.amount())));
      }
      String err = PaymentAllocator.validateExplicit(allocations, amountMinor);
      if (err != null) throw new ApiException(400, "INVALID_ALLOCATIONS", err);
      for (Allocation a : allocations) {
        Invoice inv = openById.get(a.invoiceId());
        if (inv == null) {
          throw new ApiException(400, "INVALID_ALLOCATIONS",
              "Allocations may only target the member's open invoices");
        }
        if (a.amountMinor() > inv.getAmountDueMinor()) {
          throw new ApiException(422, "EXCEEDS_DUE",
              "Allocation exceeds " + inv.getCode() + " outstanding due");
        }
      }
    } else {
      List<OpenInvoice> candidates = open.stream()
          .map(i -> new OpenInvoice(i.getId(), i.getAmountDueMinor(),
              i.getDueDate() != null ? i.getDueDate() : i.getPeriodStart(), i.getPeriodStart()))
          .toList();
      allocations = PaymentAllocator.allocateOldestFirst(candidates, amountMinor).allocations();
    }

    int allocatedMinor = allocations.stream().mapToInt(Allocation::amountMinor).sum();
    String propertyId = !allocations.isEmpty()
        ? openById.get(allocations.get(0).invoiceId()).getPropertyId()
        : member.homePropertyId();

    int year = currentYear();
    String code = numbering.next("PMT:" + year, n -> "PMT-" + year + "-" + String.format("%04d", n));
    Payment payment = new Payment(code, member.id(), propertyId, req.method(), amountMinor, tenantId);
    payment.setRemainingMinor(amountMinor - allocatedMinor);
    payment.setGatewayRef(req.gatewayRef());
    payment.setIdempotencyKey(req.idempotencyKey());
    payment.setCreatedById(user.id());
    for (Allocation a : allocations) {
      payment.getAllocations().add(new PaymentAllocation(a.invoiceId(), a.amountMinor(), tenantId));
    }
    payments.save(payment);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M09").action("create").entityType("payment").entityId(payment.getId())
        .summary("Payment " + code + " recorded: " + money(amountMinor) + " via " + req.method()
            + " (" + money(allocatedMinor) + " allocated, " + money(amountMinor - allocatedMinor) + " credit)")
        .build());
    return new CreatePaymentResult(payment.getId(), code, allocatedMinor,
        amountMinor - allocatedMinor, false);
  }

  // ---- confirm ------------------------------------------------------------

  @Transactional
  public ConfirmResult confirm(AuthPrincipal user, String id) {
    Payment payment = load(id);
    requireUpdate(user, payment);
    if ("confirmed".equals(payment.getStatus())) {
      return new ConfirmResult(true, payment.getReceiptCode(), "confirmed"); // idempotent (§9.6)
    }
    if (!PaymentMachine.canTransition(payment.getStatus(), "confirmed")) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot confirm a " + payment.getStatus() + " payment");
    }
    String tenantId = TenantContext.get();
    int year = currentYear();
    String receiptCode = numbering.next("RCP:" + year, n -> "RCP-" + year + "-" + String.format("%04d", n));
    payment.setStatus("confirmed");
    payment.setConfirmedAt(java.time.Instant.now());
    payment.setReceiptCode(receiptCode);

    for (PaymentAllocation alloc : payment.getAllocations()) {
      Invoice inv = invoices.findByIdAndTenantId(alloc.getInvoiceId(), tenantId)
          .orElseThrow(() -> ApiException.notFound("Allocated invoice not found"));
      inv.setAmountPaidMinor(inv.getAmountPaidMinor() + alloc.getAmountMinor());
      inv.recompute();
      if (inv.getAmountDueMinor() == 0 && canInvoiceSafe(inv.getStatus(), "paid")) {
        inv.setStatus("paid");
      } else if (inv.getAmountDueMinor() > 0 && canInvoiceSafe(inv.getStatus(), "partial_paid")) {
        inv.setStatus("partial_paid");
      }
      invoices.save(inv);
      // M10: paying (part of) a deposit invoice advances its deposit
      // (billed→held). No-op until the finance/deposits module registers the
      // DepositAdvancePort bean.
      if (inv.isDeposit()) {
        deposits.onDepositInvoicePaid(inv.getId());
      }
    }
    payments.save(payment);

    ledger.onPaymentConfirmed(payment.getId(), payment.getPropertyId(),
        payment.getMemberProfileId(), payment.getMethod(), payment.getAmountMinor(), receiptCode);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M09").action("update").entityType("payment").entityId(id)
        .summary("Payment " + payment.getCode() + " confirmed — receipt " + receiptCode
            + " (" + money(payment.getAmountMinor()) + " via " + payment.getMethod() + ")")
        .before("{\"status\":\"pending\"}").after("{\"status\":\"confirmed\"}")
        .build());
    return new ConfirmResult(false, receiptCode, "confirmed");
  }

  // ---- fail ---------------------------------------------------------------

  @Transactional
  public ConfirmResult fail(AuthPrincipal user, String id, String reason) {
    if (reason == null || reason.trim().length() < 3) {
      throw new ApiException(400, "REASON_REQUIRED", "A fail reason (>=3 chars) is mandatory");
    }
    Payment payment = load(id);
    requireUpdate(user, payment);
    if (!PaymentMachine.canTransition(payment.getStatus(), "failed")) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot fail a " + payment.getStatus() + " payment");
    }
    payment.setStatus("failed");
    payment.setFailedAt(java.time.Instant.now());
    payment.setFailReason(reason);
    payments.save(payment);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M09").action("update").entityType("payment").entityId(id)
        .summary("Payment " + payment.getCode() + " marked failed: " + reason)
        .build());
    return new ConfirmResult(false, null, "failed");
  }

  // ---- refund -------------------------------------------------------------

  /**
   * Refund the UNALLOCATED remainder (member credit) — Accountant+ only
   * (GLOBAL M09:update). Allocated amounts are not refundable in v1: the invoice
   * machine treats {@code paid} as terminal (parity with the Next service).
   */
  @Transactional
  public ConfirmResult refund(AuthPrincipal user, String id, String reason) {
    if (reason == null || reason.trim().length() < 3) {
      throw new ApiException(400, "REASON_REQUIRED", "A refund reason (>=3 chars) is mandatory");
    }
    if (!"GLOBAL".equals(Rbdc.widestScope(user, "update", "M09"))) {
      throw new ApiException(403, "FORBIDDEN", "Refunds require Accountant approval");
    }
    Payment payment = load(id);
    if (!PaymentMachine.canTransition(payment.getStatus(), "refunded")) {
      throw new ApiException(422, "INVALID_TRANSITION",
          "Cannot refund a " + payment.getStatus() + " payment");
    }
    if (payment.getRemainingMinor() <= 0) {
      throw new ApiException(422, "NOTHING_TO_REFUND",
          "Fully allocated payments have no refundable credit in v1");
    }
    int amount = payment.getRemainingMinor();
    payment.setStatus("refunded");
    payment.setRefundedMinor(amount);
    payment.setRemainingMinor(0);
    payment.setRefundReason(reason);
    payment.setRefundedAt(java.time.Instant.now());
    payments.save(payment);

    ledger.onPaymentRefunded(payment.getId(), payment.getPropertyId(),
        payment.getMemberProfileId(), payment.getMethod(), amount, reason);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M09").action("update").entityType("payment").entityId(id)
        .summary("Payment " + payment.getCode() + " refunded " + money(amount) + " (member credit): " + reason)
        .before("{\"status\":\"confirmed\"}").after("{\"status\":\"refunded\"}")
        .build());
    return new ConfirmResult(false, payment.getReceiptCode(), "refunded");
  }

  // ---- helpers ------------------------------------------------------------

  /** App-level invoice transition guard (issued/partial_paid/overdue → paid|partial_paid). */
  private static boolean canInvoiceSafe(String from, String to) {
    return switch (from) {
      case "issued", "overdue" -> "paid".equals(to) || "partial_paid".equals(to);
      case "partial_paid" -> "paid".equals(to);
      default -> false;
    };
  }

  private Payment load(String id) {
    return payments.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Payment not found"));
  }

  private void requireRead(AuthPrincipal user, Payment p) {
    if (!Rbdc.can(user, "read", "M09")
        && !(p.getPropertyId() != null
            && Rbdc.can(user, "read", "M09", Rbdc.ResourceRef.property(p.getPropertyId())))) {
      throw ApiException.forbidden("M09", "read");
    }
  }

  private void requireUpdate(AuthPrincipal user, Payment p) {
    if (!Rbdc.can(user, "update", "M09")
        && !(p.getPropertyId() != null
            && Rbdc.can(user, "update", "M09", Rbdc.ResourceRef.property(p.getPropertyId())))) {
      throw ApiException.forbidden("M09", "update");
    }
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }
}
