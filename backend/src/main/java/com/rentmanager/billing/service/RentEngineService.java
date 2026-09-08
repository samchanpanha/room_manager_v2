package com.rentmanager.billing.service;

import com.rentmanager.billing.BillingQueryApi;
import com.rentmanager.billing.domain.Invoice;
import com.rentmanager.billing.domain.InvoiceItem;
import com.rentmanager.billing.domain.InvoiceRepository;
import com.rentmanager.billing.domain.LateFeeRule;
import com.rentmanager.billing.domain.LateFeeRuleRepository;
import com.rentmanager.billing.domain.TaxRule;
import com.rentmanager.billing.domain.TaxRuleRepository;
import com.rentmanager.billing.engine.Proration;
import com.rentmanager.billing.engine.RentEngine;
import com.rentmanager.billing.spi.LedgerPostingPort;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.settings.SettingsService;
import com.rentmanager.kernel.tenant.TenantContext;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rent engine job service (INTENT.md M06) — a port of the generation, late-fee
 * and dunning halves of {@code src/lib/billing/service.tsx}. Composition uses the
 * pure {@link RentEngine}; persistence + ledger posting mirror the invoice-issue
 * path so a generated invoice is indistinguishable from a hand-issued one.
 *
 * <p>Generation is invoked <em>per lease</em> by the leasing module (which owns
 * lease state and may depend on billing); this keeps the module graph acyclic —
 * billing never depends on leasing.
 */
@Service
public class RentEngineService {

  /** Safety bound on catch-up periods generated in a single run (port parity). */
  private static final int MAX_CATCHUP_PERIODS = 24;

  private final InvoiceRepository invoices;
  private final TaxRuleRepository taxRules;
  private final LateFeeRuleRepository lateFeeRules;
  private final NumberingService numbering;
  private final SettingsService settings;
  private final AuditService audit;
  private final LedgerPostingPort ledger;
  private final com.rentmanager.billing.spi.UtilityBillingPort utilities;

  public RentEngineService(InvoiceRepository invoices, TaxRuleRepository taxRules,
      LateFeeRuleRepository lateFeeRules, NumberingService numbering, SettingsService settings,
      AuditService audit, LedgerPostingPort ledger,
      com.rentmanager.billing.spi.UtilityBillingPort utilities) {
    this.invoices = invoices;
    this.taxRules = taxRules;
    this.lateFeeRules = lateFeeRules;
    this.numbering = numbering;
    this.settings = settings;
    this.audit = audit;
    this.ledger = ledger;
    this.utilities = utilities;
  }

  // ---- generation --------------------------------------------------------
  // The generation input/output DTOs live on the published BillingQueryApi so
  // the leasing module (which drives generation per active lease) can construct
  // them without importing this internal service.

  /**
   * Periods awaiting billing for a lease, chaining from the last invoiced period
   * up to (and including the one containing) {@code today}. Pure — a port of
   * {@code computePendingPeriods}.
   */
  public static List<Instant[]> computePendingPeriods(Instant startDate, int billingCycleDay,
      Instant lastPeriodEnd, Instant today) {
    List<Instant[]> out = new ArrayList<>();
    Instant start = lastPeriodEnd != null ? lastPeriodEnd : startDate;
    for (int i = 0; i < MAX_CATCHUP_PERIODS; i++) {
      if (start.isAfter(today)) break;
      Instant end = Proration.nextCycleBoundary(start, billingCycleDay);
      out.add(new Instant[] {start, end});
      start = end;
    }
    return out;
  }

  /**
   * Compose + issue invoices for one active lease's pending periods. Idempotent:
   * skips a period that already has a live invoice, so re-runs only fill gaps.
   */
  @Transactional
  public List<BillingQueryApi.GeneratedInvoice> generateForLease(BillingQueryApi.LeaseGenerationInput lease, String actorId,
      String actorName) {
    String tenantId = TenantContext.get();
    Instant today = Proration.utcMidnight(Instant.now());

    int taxBps = taxRules.findFirstByTenantIdAndIsActiveTrueAndIsDefaultTrue(tenantId)
        .map(TaxRule::getPercentBps).orElse(0);
    String prefix = settings.billing().invoicePrefix();

    Invoice last = invoices
        .findFirstByLeaseIdAndTenantIdAndDepositFalseAndStatusNotOrderByPeriodEndDesc(
            lease.leaseId(), tenantId, "void")
        .orElse(null);
    List<Instant[]> periods = computePendingPeriods(lease.startDate(), lease.billingCycleDay(),
        last != null ? last.getPeriodEnd() : null, today);

    List<BillingQueryApi.GeneratedInvoice> generated = new ArrayList<>();
    for (Instant[] period : periods) {
      Instant periodStart = period[0];
      Instant periodEnd = period[1];
      if (invoices.existsByLeaseIdAndPeriodStartAndTenantIdAndDepositFalseAndStatusNot(
          lease.leaseId(), periodStart, tenantId, "void")) {
        continue; // idempotent — a live invoice already covers this period
      }

      List<RentEngine.ServiceInput> svcs = lease.services().stream()
          .map(s -> new RentEngine.ServiceInput(s.name(), s.amountMinor(), s.pricingModel(),
              s.activeFrom(), s.activeThrough()))
          .toList();
      // M11 — fold this lease's pending utility charges in as one-time lines.
      List<com.rentmanager.billing.spi.UtilityBillingPort.PendingCharge> pendingUtils =
          utilities.pendingForLease(lease.leaseId());
      List<RentEngine.OneTimeLine> oneTimeLines = pendingUtils.stream()
          .map(c -> new RentEngine.OneTimeLine(c.kind(), c.name(), c.amountMinor()))
          .toList();
      RentEngine.CompositionResult comp = RentEngine.composeInvoice(new RentEngine.CompositionInput(
          new RentEngine.LeaseInput(lease.rentMinor(), lease.billingCycleDay(),
              Proration.Basis.parse(lease.prorationBasis()), svcs),
          periodStart, periodEnd, taxBps, 0, oneTimeLines,
          RentEngine.formatPeriodLabel(periodStart, periodEnd)));

      int year = periodStart.atZone(ZoneOffset.UTC).getYear();
      String code = numbering.next("INV:" + lease.propertyCode() + ":" + year,
          n -> prefix + lease.propertyCode() + "-" + year + "-" + String.format("%04d", n));
      Instant dueDate = periodStart.isBefore(today) ? today : periodStart;

      Invoice invoice = new Invoice(code, lease.propertyId(), lease.memberProfileId(),
          periodStart, periodEnd, tenantId);
      invoice.setLeaseId(lease.leaseId());
      invoice.setStatus("issued");
      invoice.setIssuedAt(Instant.now());
      invoice.setDueDate(dueDate);
      invoice.setDiscountMinor(comp.discountMinor());
      invoice.setTaxMinor(comp.taxMinor());
      invoice.setCreatedById(actorId);
      for (RentEngine.Line l : comp.lines()) {
        invoice.getItems().add(new InvoiceItem(l.kind(), l.name(), l.qty(), l.unitMinor(), tenantId));
      }
      invoice.recompute();
      invoices.save(invoice);

      // M11 — flip the folded-in utility charges pending → billed against this invoice.
      if (!pendingUtils.isEmpty()) {
        utilities.markBilled(pendingUtils.stream()
            .map(com.rentmanager.billing.spi.UtilityBillingPort.PendingCharge::chargeId).toList(),
            invoice.getId());
      }

      // M08 accrual posting — DR receivable / CR revenue by kind (+ tax → 2300).
      ledger.onInvoiceIssued(invoice.getId(), invoice.getPropertyId(),
          invoice.getMemberProfileId(), invoice.getTotalMinor(), invoice.getDiscountMinor(),
          invoice.getTaxMinor(), comp.lines().stream()
              .map(l -> new LedgerPostingPort.InvoiceLine(l.kind(), l.amountMinor()))
              .toList());

      audit.log(AuditEntry.builder()
          .actorId(actorId).actorName(actorName)
          .module("M07").action("create").entityType("invoice").entityId(invoice.getId())
          .summary("Generation job issued " + code + " for " + lease.leaseCode() + " ("
              + lease.memberName() + "): " + comp.lines().size() + " line(s), total "
              + money(comp.totalMinor()))
          .build());

      generated.add(new BillingQueryApi.GeneratedInvoice(invoice.getId(), code, lease.leaseCode(),
          comp.totalMinor(), periodStart, periodEnd));
    }
    return generated;
  }

  // ---- late fees ---------------------------------------------------------

  public record LateFeeResult(int applied, int checked) {}

  /**
   * Apply the late fee once per overdue invoice past the grace cutoff. An
   * explicit M06 {@link LateFeeRule} wins; otherwise the M28 org defaults apply
   * (mode "none" disables late fees entirely).
   */
  @Transactional
  public LateFeeResult applyLateFees(String actorId, String actorName) {
    String tenantId = TenantContext.get();
    RentEngine.LateFeeRule rule = resolveLateFeeRule(tenantId);
    if (rule == null) return new LateFeeResult(0, 0);

    Instant today = Proration.utcMidnight(Instant.now());
    Instant graceCutoff = today.minusMillis((long) rule.graceDays() * 86_400_000L);
    List<Invoice> candidates = invoices.findLateFeeCandidates(tenantId, graceCutoff);

    int applied = 0;
    for (Invoice inv : candidates) {
      boolean alreadyCharged = inv.getItems().stream().anyMatch(i -> "late_fee".equals(i.getKind()));
      if (alreadyCharged) continue; // once per invoice
      Integer fee = RentEngine.evalLateFee(rule, inv.getAmountDueMinor());
      if (fee == null || fee <= 0) continue;
      long daysPast = Math.floorDiv(today.toEpochMilli()
          - (inv.getDueDate() != null ? inv.getDueDate().toEpochMilli() : today.toEpochMilli()),
          86_400_000L);

      String feeLabel = "Late fee (" + ("PERCENT".equals(rule.type())
          ? (rule.percentBps() == null ? 0 : rule.percentBps() / 100.0) + "%" : "fixed")
          + ", " + daysPast + "d past due)";
      inv.getItems().add(new InvoiceItem("late_fee", feeLabel, 1, fee, tenantId));
      inv.recompute();
      invoices.save(inv);

      ledger.onLateFeeApplied(inv.getId(), inv.getPropertyId(), inv.getMemberProfileId(),
          inv.getCode(), fee);

      audit.log(AuditEntry.builder()
          .actorId(actorId).actorName(actorName)
          .module("M06").action("update").entityType("invoice_late_fee").entityId(inv.getId())
          .summary("Late fee " + money(fee) + " applied to " + inv.getCode() + " (" + daysPast
              + "d past due, grace " + rule.graceDays() + "d)")
          .build());
      applied++;
    }
    return new LateFeeResult(applied, candidates.size());
  }

  private RentEngine.LateFeeRule resolveLateFeeRule(String tenantId) {
    LateFeeRule explicit = lateFeeRules.findFirstByTenantIdAndIsActiveTrue(tenantId).orElse(null);
    if (explicit != null) {
      return new RentEngine.LateFeeRule(explicit.getType(), explicit.getAmountMinor(),
          explicit.getPercentBps(), explicit.getCapMinor(), explicit.getGraceDays());
    }
    SettingsService.LateFeeSettings s = settings.lateFee();
    if ("none".equals(s.mode())) return null;
    int grace = settings.billing().graceDays();
    if ("percent".equals(s.mode())) {
      return new RentEngine.LateFeeRule("PERCENT", null, s.monthlyPctBps(),
          s.maxMinor() > 0 ? s.maxMinor() : null, grace);
    }
    return new RentEngine.LateFeeRule("FIXED", s.flatMinor(), null,
        s.maxMinor() > 0 ? s.maxMinor() : null, grace);
  }

  // ---- dunning -----------------------------------------------------------

  public record DunningResult(int overdueMarked, int remindersSent) {}

  /**
   * Mark invoices overdue past the grace period and advance the dunning stage
   * ladder (+3/+7/+14 by default). Delivery channels consume the audit trail /
   * events; here we drive only the status + stage transitions.
   */
  @Transactional
  public DunningResult runDunning(String actorId, String actorName) {
    String tenantId = TenantContext.get();
    Instant today = Proration.utcMidnight(Instant.now());
    SettingsService.BillingSettings billing = settings.billing();
    List<Integer> schedule = billing.dunningDays();

    List<Invoice> open = invoices.findDunningCandidates(tenantId, today);
    int overdueMarked = 0;
    int remindersSent = 0;
    for (Invoice inv : open) {
      long daysPast = Math.floorDiv(today.toEpochMilli()
          - (inv.getDueDate() != null ? inv.getDueDate().toEpochMilli() : today.toEpochMilli()),
          86_400_000L);
      boolean changed = false;
      boolean markedOverdue = false;
      if (!"overdue".equals(inv.getStatus()) && daysPast > billing.graceDays()
          && InvoiceMachine.canTransition(inv.getStatus(), "overdue")) {
        inv.setStatus("overdue");
        changed = true;
        markedOverdue = true;
        overdueMarked++;
      }
      int stage = RentEngine.dunningStage(daysPast, schedule);
      if (stage > inv.getDunningStage()) {
        inv.setDunningStage(stage);
        changed = true;
        remindersSent++;
        audit.log(AuditEntry.builder()
            .actorId(actorId).actorName(actorName)
            .module("M07").action("update").entityType("invoice_dunning").entityId(inv.getId())
            .summary(inv.getCode() + ": " + (markedOverdue ? "marked overdue; " : "")
                + "dunning stage " + stage + " (day " + daysPast + " past due)")
            .build());
      }
      if (changed) invoices.save(inv);
    }
    return new DunningResult(overdueMarked, remindersSent);
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }
}
