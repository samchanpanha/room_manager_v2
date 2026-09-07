package com.rentmanager.finance.ledger.service;

import com.rentmanager.finance.ledger.domain.LedgerAccount;
import com.rentmanager.finance.ledger.domain.LedgerAccountRepository;
import com.rentmanager.finance.ledger.domain.LedgerEntry;
import com.rentmanager.finance.ledger.domain.LedgerTransaction;
import com.rentmanager.finance.ledger.domain.LedgerTransactionRepository;
import com.rentmanager.finance.ledger.service.Postings.Line;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ledger service (INTENT.md M08) — the only writer of ledger rows. Everything is
 * append-only: post balanced transactions, correct via reversals; no update or
 * delete exists. A port of {@code src/lib/ledger/service.ts} (post / reverse /
 * live-lookup). Tenant-scoped through {@link TenantContext}.
 */
@Service
public class LedgerService {

  private final LedgerAccountRepository accounts;
  private final LedgerTransactionRepository transactions;

  public LedgerService(LedgerAccountRepository accounts, LedgerTransactionRepository transactions) {
    this.accounts = accounts;
    this.transactions = transactions;
  }

  /** Inputs to post one balanced transaction. */
  public record PostInput(String memo, String refType, String refId, String propertyId,
      String memberId, String actorId, String reversalOfId, List<Line> lines) {}

  /**
   * Post one balanced transaction (+ its entry lines). Throws UNBALANCED on any
   * math violation so the surrounding transaction rolls back.
   */
  @Transactional
  public String post(PostInput input) {
    Postings.assertBalanced(input.lines());
    String tenantId = TenantContext.get();

    List<String> codes = input.lines().stream().map(l -> l.code).distinct().toList();
    Map<String, LedgerAccount> byCode = new HashMap<>();
    for (LedgerAccount a : accounts.findByCodeInAndActiveTrue(codes)) byCode.put(a.getCode(), a);
    for (String code : codes) {
      if (!byCode.containsKey(code)) {
        throw new IllegalStateException("UNBALANCED: unknown or inactive account " + code);
      }
    }

    int totalDebit = input.lines().stream().mapToInt(l -> l.debit).sum();
    LedgerTransaction txn = new LedgerTransaction(input.memo(), input.refType(), input.refId(),
        input.propertyId(), input.memberId(), totalDebit, input.reversalOfId(),
        input.actorId(), tenantId);
    for (Line l : input.lines()) {
      txn.getEntries().add(new LedgerEntry(byCode.get(l.code).getId(), l.debit, l.credit,
          l.memo, input.propertyId(), input.memberId(), tenantId));
    }
    transactions.save(txn);
    return txn.getId();
  }

  /**
   * Reverse a posted transaction (mirror lines + reversalOf back-link). Rejects
   * double reversals — one reversal per original.
   */
  @Transactional
  public String reverse(String originalId, String memo, String refType, String refId, String actorId) {
    String tenantId = TenantContext.get();
    LedgerTransaction original = transactions.findById(originalId)
        .filter(t -> tenantId.equals(t.getTenantId()))
        .orElseThrow(() -> new ApiException(422, "REVERSAL_FAILED", "original transaction not found"));
    if (transactions.findFirstByReversalOfIdAndTenantId(originalId, tenantId).isPresent()) {
      throw new ApiException(422, "REVERSAL_FAILED", "transaction already reversed");
    }

    // Resolve entry account codes to rebuild the mirrored lines.
    Map<String, LedgerAccount> byId = new HashMap<>();
    for (LedgerAccount a : accounts.findAll()) byId.put(a.getId(), a);
    List<Line> originalLines = original.getEntries().stream()
        .map(e -> new Line(byId.get(e.getAccountId()).getCode(), e.getDebit(), e.getCredit(), e.getMemo()))
        .toList();
    List<Line> mirrored = Postings.reversalLines(originalLines);

    return post(new PostInput(memo, refType, refId != null ? refId : original.getRefId(),
        original.getPropertyId(), original.getMemberId(), actorId, originalId, mirrored));
  }

  /** Transactions referencing a ref that have not been reversed yet. */
  @Transactional(readOnly = true)
  public List<LedgerTransaction> liveTransactions(List<String> refTypes, String refId) {
    return transactions.findLive(TenantContext.get(), refTypes, refId);
  }

  /** The live revenue credit lines of a ref's postings — for credit-note proration. */
  @Transactional(readOnly = true)
  public List<Line> liveRevenueLines(List<String> refTypes, String refId) {
    Map<String, LedgerAccount> byId = new HashMap<>();
    for (LedgerAccount a : accounts.findAll()) byId.put(a.getId(), a);
    return liveTransactions(refTypes, refId).stream()
        .flatMap(t -> t.getEntries().stream())
        .filter(e -> e.getCredit() > 0)
        .map(e -> Line.credit(byId.get(e.getAccountId()).getCode(), e.getCredit(), null))
        // 2300 tax is not "revenue" that a credit note reverses.
        .filter(l -> !ChartOfAccounts.TAX_PAYABLE.equals(l.code))
        .toList();
  }
}
