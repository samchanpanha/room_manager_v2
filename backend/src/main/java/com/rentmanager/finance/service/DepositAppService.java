package com.rentmanager.finance.service;

import com.rentmanager.billing.BillingQueryApi;
import com.rentmanager.billing.spi.LedgerPostingPort;
import com.rentmanager.finance.domain.Deposit;
import com.rentmanager.finance.domain.DepositRepository;
import com.rentmanager.finance.domain.DepositTransaction;
import com.rentmanager.finance.dto.DeductRequest;
import com.rentmanager.finance.dto.DepositDetail;
import com.rentmanager.finance.dto.DepositSummary;
import com.rentmanager.finance.dto.DepositTransactionDto;
import com.rentmanager.finance.dto.RefundRequest;
import com.rentmanager.finance.dto.SettlementResult;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.leasing.LeasingQueryApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deposit use-cases (INTENT.md M10) — published API of the finance module.
 * Ports {@code src/lib/deposits/service.ts}: bill a deposit as an installment
 * {@code deposit}-kind invoice (via billing), advance its status from its
 * collection/settlement facts (pending → billed → held → settled), and record
 * deduction / refund movements at move-out. Ledger postings (M08) are delegated
 * through the billing {@link LedgerPostingPort} SPI; no-op until the ledger is
 * ported (parity gap tracked in docs/backend-split-plan.md).
 */
@Service
public class DepositAppService {

  private final DepositRepository deposits;
  private final BillingQueryApi billing;
  private final LeasingQueryApi leasing;
  private final LedgerPostingPort ledger;
  private final AuditService audit;

  public DepositAppService(DepositRepository deposits, BillingQueryApi billing,
      LeasingQueryApi leasing, LedgerPostingPort ledger, AuditService audit) {
    this.deposits = deposits;
    this.billing = billing;
    this.leasing = leasing;
    this.ledger = ledger;
    this.audit = audit;
  }

  private static int toMinor(Double major) {
    return major == null ? 0 : (int) Math.round(major * 100);
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }

  // ---- money facts --------------------------------------------------------

  /** Held = collected (deposit invoice paid) − released (movements), floored 0. */
  private int remaining(Deposit d) {
    int collected = collected(d);
    return Math.max(0, collected - d.releasedMinor());
  }

  private int collected(Deposit d) {
    if (d.getInvoiceId() == null) return 0;
    BillingQueryApi.InvoiceFacts f = billing.invoiceFacts(d.getInvoiceId());
    return f == null ? 0 : f.amountPaidMinor();
  }

  /**
   * Recompute + persist the deposit status from its facts (idempotent,
   * forward-only): billed → held (invoice fully collected) → settled (liability
   * released by movements). Used both directly and via the DepositAdvancePort.
   */
  @Transactional
  public String refreshStatus(String depositId) {
    Deposit d = deposits.findByIdAndTenantId(depositId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Deposit not found"));
    return refreshStatus(d);
  }

  private String refreshStatus(Deposit d) {
    String current = d.getStatus();
    String next = current;
    int released = d.releasedMinor();
    if (d.getInvoiceId() != null) {
      BillingQueryApi.InvoiceFacts f = billing.invoiceFacts(d.getInvoiceId());
      if (f != null && f.amountPaidMinor() >= f.totalMinor()
          && DepositMachine.canTransition(next, "held")) {
        next = "held";
      }
    }
    int remaining = Math.max(0, collected(d) - released);
    if (remaining == 0 && released > 0 && DepositMachine.canTransition(next, "settled")) {
      next = "settled";
    }
    if (!next.equals(current)) {
      d.setStatus(next);
      deposits.save(d);
    }
    return next;
  }

  // ---- ensure + bill ------------------------------------------------------

  /**
   * Create the deposit record + bill it as an installment {@code deposit}-kind
   * invoice (idempotent per lease). Called from lease activation through the
   * DepositBillingPort. Returns null when the lease has no deposit terms.
   */
  @Transactional
  public EnsureResult ensureForLease(String leaseId, String actorId) {
    String tenantId = TenantContext.get();
    var existing = deposits.findByLeaseIdAndTenantId(leaseId, tenantId);
    if (existing.isPresent()) {
      Deposit d = existing.get();
      String code = null;
      if (d.getInvoiceId() != null) {
        BillingQueryApi.InvoiceFacts f = billing.invoiceFacts(d.getInvoiceId());
        code = f == null ? null : f.id();
      }
      return new EnsureResult(d.getId(), code, false);
    }

    LeasingQueryApi.LeaseInfo lease = leasing.get(leaseId);
    if (lease.depositTotalMinor() <= 0) return null;

    int[] amounts = DepositMachine.installmentSplit(lease.depositTotalMinor(), lease.depositInstallments());
    List<BillingQueryApi.DepositLine> lines = new ArrayList<>();
    for (int i = 0; i < amounts.length; i++) {
      lines.add(new BillingQueryApi.DepositLine(
          "Security deposit installment " + (i + 1) + "/" + amounts.length, amounts[i]));
    }
    // Bill the deposit invoice (issued, due at move-in) through billing.
    BillingQueryApi.InvoiceFacts invoice = billing.billDepositInvoice(
        lease.propertyId(), lease.id(), lease.memberProfileId(), lease.startDate(), lines, actorId);

    Deposit deposit = new Deposit(lease.id(), lease.memberProfileId(), lease.propertyId(),
        lease.depositTotalMinor(), tenantId);
    deposit.setStatus("billed");
    deposit.setInvoiceId(invoice.id());
    deposit.setCreatedById(actorId);
    deposits.save(deposit);

    ledger.onDepositBilled(invoice.id(), lease.propertyId(), lease.memberProfileId(), invoice.totalMinor());

    audit.log(AuditEntry.builder()
        .actorId(actorId).actorName("system")
        .module("M10").action("deposit.billed").entityType("deposit").entityId(deposit.getId())
        .summary("Deposit billed for " + lease.code() + ": " + money(invoice.totalMinor())
            + " in " + lease.depositInstallments() + " installment(s)")
        .build());
    return new EnsureResult(deposit.getId(), invoice.id(), true);
  }

  public record EnsureResult(String depositId, String invoiceId, boolean created) {}

  // ---- list / get ---------------------------------------------------------

  @Transactional(readOnly = true)
  public List<DepositSummary> list(AuthPrincipal user, String status) {
    String scope = Rbdc.widestScope(user, "read", "M10");
    if (scope == null) throw ApiException.forbidden("M10", "read");
    String tenantId = TenantContext.get();
    List<Deposit> rows = status != null
        ? deposits.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, status)
        : deposits.findByTenantIdOrderByCreatedAtDesc(tenantId);
    if ("PROPERTY".equals(scope)) {
      if (user.propertyIds().isEmpty()) return List.of();
      rows = rows.stream()
          .filter(d -> d.getPropertyId() != null && user.propertyIds().contains(d.getPropertyId()))
          .toList();
    } else if (!"GLOBAL".equals(scope)) {
      return List.of();
    }
    return rows.stream().map(this::toSummary).toList();
  }

  @Transactional(readOnly = true)
  public DepositDetail get(AuthPrincipal user, String id) {
    Deposit d = load(id);
    requireRead(user, d);
    return new DepositDetail(toSummary(d),
        d.getTransactions().stream().map(DepositTransactionDto::from).toList());
  }

  // ---- deduct -------------------------------------------------------------

  @Transactional
  public SettlementResult deduct(AuthPrincipal user, String id, DeductRequest req) {
    Deposit d = load(id);
    requireUpdate(user, d);
    int amount = toMinor(req.amount());
    if (amount <= 0) throw new ApiException(400, "INVALID_AMOUNT", "Deduction must be positive");
    if (!DepositMachine.isDeductionReason(req.reason())) {
      throw new ApiException(400, "INVALID_REASON", "Unknown deduction reason");
    }
    if (req.note() == null || req.note().trim().length() < 3) {
      throw new ApiException(400, "NOTE_REQUIRED", "A written note is required");
    }
    if (req.evidenceDocId() == null || req.evidenceDocId().isBlank()) {
      throw new ApiException(400, "EVIDENCE_REQUIRED",
          "Deductions require an evidence document (M17 registry id)");
    }
    if ("settled".equals(d.getStatus())) {
      throw new ApiException(422, "ALREADY_SETTLED", "Deposit already settled");
    }
    if (!leaseAllowsSettlement(d)) {
      throw new ApiException(422, "LEASE_ACTIVE",
          "Settlement opens at move-out (notice / completed / terminated)");
    }
    int remaining = remaining(d);
    if (remaining <= 0) throw new ApiException(422, "NOTHING_HELD", "No collected deposit held");
    if (amount > remaining) {
      throw new ApiException(422, "EXCEEDS_HELD",
          "Deduction exceeds the held amount (" + money(remaining) + ")");
    }

    String ledgerTxId = ledger.onDepositDeducted(d.getId(), d.getPropertyId(),
        d.getMemberProfileId(), amount, req.reason());
    DepositTransaction tx = new DepositTransaction("deduction", amount, req.reason(),
        req.evidenceDocId(), req.note(), null, user.id(), d.getTenantId());
    tx.setLedgerTxId(ledgerTxId);
    d.getTransactions().add(tx);
    deposits.save(d);
    refreshStatus(d);

    int after = remaining(d);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M10").action("deposit.deducted").entityType("deposit").entityId(d.getId())
        .summary("Deposit deduction " + money(amount) + " (" + req.reason() + ") — remaining "
            + money(after) + ", evidence " + req.evidenceDocId())
        .build());
    return new SettlementResult(after, d.getStatus());
  }

  // ---- refund -------------------------------------------------------------

  /** Refund the deposit remainder — Accountant+ only (GLOBAL M10:update). */
  @Transactional
  public SettlementResult refund(AuthPrincipal user, String id, RefundRequest req) {
    if (!"GLOBAL".equals(Rbdc.widestScope(user, "update", "M10"))) {
      throw new ApiException(403, "FORBIDDEN", "Deposit refunds require Accountant approval");
    }
    Deposit d = load(id);
    if ("settled".equals(d.getStatus())) {
      throw new ApiException(422, "ALREADY_SETTLED", "Deposit already settled");
    }
    if (!leaseAllowsSettlement(d)) {
      throw new ApiException(422, "LEASE_ACTIVE",
          "Settlement opens at move-out (notice / completed / terminated)");
    }
    if (req.note() == null || req.note().trim().length() < 3) {
      throw new ApiException(400, "NOTE_REQUIRED", "A written note is required");
    }
    int remaining = remaining(d);
    if (remaining <= 0) throw new ApiException(422, "NOTHING_TO_REFUND", "No collected deposit held");
    int amount = req.amount() == null ? remaining : toMinor(req.amount());
    if (amount <= 0) throw new ApiException(400, "INVALID_AMOUNT", "Refund must be positive");
    if (amount > remaining) {
      throw new ApiException(422, "EXCEEDS_HELD",
          "Refund exceeds the held amount (" + money(remaining) + ")");
    }
    String method = req.method() == null ? "bank_transfer" : req.method();

    String ledgerTxId = ledger.onDepositRefunded(d.getId(), d.getPropertyId(),
        d.getMemberProfileId(), amount, method, req.note());
    DepositTransaction tx = new DepositTransaction("refund", amount, null, null,
        req.note(), method, user.id(), d.getTenantId());
    tx.setLedgerTxId(ledgerTxId);
    d.getTransactions().add(tx);
    deposits.save(d);
    refreshStatus(d);

    int after = remaining(d);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M10").action("deposit.refunded").entityType("deposit").entityId(d.getId())
        .summary("Deposit refund " + money(amount) + " via " + method + " — remaining " + money(after))
        .build());
    return new SettlementResult(after, d.getStatus());
  }

  // ---- helpers ------------------------------------------------------------

  private boolean leaseAllowsSettlement(Deposit d) {
    return DepositMachine.leaseAllowsSettlement(leasing.get(d.getLeaseId()).status());
  }

  private DepositSummary toSummary(Deposit d) {
    int collected = collected(d);
    int deducted = d.getTransactions().stream()
        .filter(t -> "deduction".equals(t.getType())).mapToInt(DepositTransaction::getAmountMinor).sum();
    int refunded = d.getTransactions().stream()
        .filter(t -> "refund".equals(t.getType())).mapToInt(DepositTransaction::getAmountMinor).sum();
    return new DepositSummary(d.getId(), d.getLeaseId(), d.getMemberProfileId(), d.getPropertyId(),
        d.getStatus(), d.getRequiredMinor(), collected, deducted, refunded,
        Math.max(0, collected - deducted - refunded), d.getInvoiceId());
  }

  private Deposit load(String id) {
    return deposits.findByIdAndTenantId(id, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Deposit not found"));
  }

  private void requireRead(AuthPrincipal user, Deposit d) {
    if (!Rbdc.can(user, "read", "M10")
        && !(d.getPropertyId() != null
            && Rbdc.can(user, "read", "M10", Rbdc.ResourceRef.property(d.getPropertyId())))) {
      throw ApiException.forbidden("M10", "read");
    }
  }

  private void requireUpdate(AuthPrincipal user, Deposit d) {
    if (!Rbdc.can(user, "update", "M10")
        && !(d.getPropertyId() != null
            && Rbdc.can(user, "update", "M10", Rbdc.ResourceRef.property(d.getPropertyId())))) {
      throw ApiException.forbidden("M10", "update");
    }
  }

  /** Called by the DepositAdvancePort when a deposit invoice receives payment. */
  @Transactional
  public void onDepositInvoicePaid(String invoiceId) {
    deposits.findByInvoiceIdAndTenantId(invoiceId, TenantContext.get())
        .ifPresent(this::refreshStatus);
  }
}
