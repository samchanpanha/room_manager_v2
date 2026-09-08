package com.rentmanager.finance.ledger.service;

import com.rentmanager.finance.ledger.domain.LedgerAccount;
import com.rentmanager.finance.ledger.domain.LedgerAccountRepository;
import com.rentmanager.finance.ledger.domain.LedgerEntry;
import com.rentmanager.finance.ledger.domain.LedgerEntryRepository;
import com.rentmanager.finance.ledger.domain.LedgerTransaction;
import com.rentmanager.finance.ledger.domain.LedgerTransactionRepository;
import com.rentmanager.finance.ledger.dto.AccountDto;
import com.rentmanager.finance.ledger.dto.JournalEntryDto;
import com.rentmanager.finance.ledger.dto.JournalTxnDto;
import com.rentmanager.finance.ledger.dto.LedgerIntegrity;
import com.rentmanager.finance.ledger.dto.MemberStatement;
import com.rentmanager.finance.ledger.dto.StatementRowDto;
import com.rentmanager.finance.ledger.dto.TrialBalance;
import com.rentmanager.finance.ledger.dto.TrialBalanceRow;
import com.rentmanager.finance.ledger.dto.MemberStatementResponse;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ledger read models (INTENT.md M08): chart of accounts, trial balance, journal
 * browser, member statement and the integrity probe. Ports the query half of
 * {@code src/lib/ledger/service.ts}. All reporting requires GLOBAL M08:read
 * (matrix: Owner/Staff/PM have no M08 cell; members get their own statement).
 */
@Service
public class LedgerQueryService {

  private final LedgerAccountRepository accounts;
  private final LedgerTransactionRepository transactions;
  private final LedgerEntryRepository entries;
  private final MemberAccessApi memberAccess;

  public LedgerQueryService(LedgerAccountRepository accounts,
      LedgerTransactionRepository transactions, LedgerEntryRepository entries,
      MemberAccessApi memberAccess) {
    this.accounts = accounts;
    this.transactions = transactions;
    this.entries = entries;
    this.memberAccess = memberAccess;
  }

  private void requireGlobalRead(AuthPrincipal user) {
    if (!"GLOBAL".equals(Rbdc.widestScope(user, "read", "M08"))) {
      throw ApiException.forbidden("M08", "read");
    }
  }

  @Transactional(readOnly = true)
  public List<AccountDto> listAccounts(AuthPrincipal user) {
    requireGlobalRead(user);
    return accounts.findAllByOrderByCodeAsc().stream().map(AccountDto::from).toList();
  }

  @Transactional(readOnly = true)
  public TrialBalance trialBalance(AuthPrincipal user) {
    requireGlobalRead(user);
    String tenantId = TenantContext.get();
    Map<String, LedgerEntryRepository.AccountSum> byAccount = new HashMap<>();
    for (LedgerEntryRepository.AccountSum s : entries.sumByAccount(tenantId)) {
      byAccount.put(s.getAccountId(), s);
    }
    List<TrialBalanceRow> rows = new ArrayList<>();
    long totalDebit = 0;
    long totalCredit = 0;
    for (LedgerAccount acc : accounts.findAllByOrderByCodeAsc()) {
      LedgerEntryRepository.AccountSum s = byAccount.get(acc.getId());
      long debit = s == null ? 0 : s.getDebit();
      long credit = s == null ? 0 : s.getCredit();
      totalDebit += debit;
      totalCredit += credit;
      long balance = ChartOfAccounts.isDebitNormal(acc.getType()) ? debit - credit : credit - debit;
      rows.add(new TrialBalanceRow(acc.getCode(), acc.getName(), acc.getType(), debit, credit, balance));
    }
    return new TrialBalance(rows, totalDebit, totalCredit, totalDebit == totalCredit);
  }

  @Transactional(readOnly = true)
  public List<JournalTxnDto> journal(AuthPrincipal user, String accountCode, String propertyId,
      String memberId, String refType, String refId, Instant from, Instant to, Integer take) {
    requireGlobalRead(user);
    String tenantId = TenantContext.get();
    int limit = Math.min(take == null ? 100 : take, 500);
    Map<String, LedgerAccount> byId = accountsById();
    List<JournalTxnDto> out = new ArrayList<>();
    for (LedgerTransaction t : transactions.journal(tenantId, refType, refId, propertyId, memberId,
        from, to, PageRequest.of(0, limit))) {
      List<JournalEntryDto> lines = new ArrayList<>();
      for (LedgerEntry e : t.getEntries()) {
        if (accountCode != null && !accountCode.equals(byId.get(e.getAccountId()).getCode())) continue;
        LedgerAccount a = byId.get(e.getAccountId());
        lines.add(new JournalEntryDto(a.getCode(), a.getName(), e.getDebit(), e.getCredit(), e.getMemo()));
      }
      out.add(new JournalTxnDto(t.getId(), t.getPostedAt(), t.getMemo(), t.getRefType(), t.getRefId(),
          t.getPropertyId(), t.getMemberId(), t.getReversalOfId() != null, t.getTotalDebit(), lines));
    }
    return out;
  }

  /**
   * Member account statement (M08 screen), matching the Next
   * {@code /api/members/[id]/statement} guard: GLOBAL M08:read sees anyone;
   * otherwise a member may view only their OWN statement (matrix cell O(stmt)).
   */
  @Transactional(readOnly = true)
  public MemberStatementResponse statementFor(AuthPrincipal user, String memberId) {
    MemberAccessApi.MemberIdentity id = memberAccess.identity(memberId);
    boolean globalRead = "GLOBAL".equals(Rbdc.widestScope(user, "read", "M08"));
    if (!globalRead) {
      if (user.partyId() == null || !user.partyId().equals(id.partyId())) {
        throw new ApiException(403, "FORBIDDEN", "Statement outside your visible scope");
      }
    }
    return MemberStatementResponse.of(id.id(), id.name(), buildStatement(memberId));
  }

  @Transactional(readOnly = true)
  public MemberStatement memberStatement(AuthPrincipal user, String memberId) {
    requireGlobalRead(user);
    return buildStatement(memberId);
  }

  private MemberStatement buildStatement(String memberId) {
    String tenantId = TenantContext.get();
    Map<String, LedgerAccount> byId = accountsById();
    long receivable = 0;
    List<StatementRowDto> rows = new ArrayList<>();
    for (LedgerTransaction t : transactions.findByMemberIdAndTenantIdOrderByPostedAtAsc(memberId, tenantId)) {
      long arDelta = 0;
      List<JournalEntryDto> lines = new ArrayList<>();
      for (LedgerEntry e : t.getEntries()) {
        LedgerAccount a = byId.get(e.getAccountId());
        if (ChartOfAccounts.RENT_RECEIVABLE.equals(a.getCode())) arDelta += e.getDebit() - e.getCredit();
        lines.add(new JournalEntryDto(a.getCode(), a.getName(), e.getDebit(), e.getCredit(), e.getMemo()));
      }
      receivable += arDelta;
      rows.add(new StatementRowDto(t.getId(), t.getPostedAt(), t.getMemo(), t.getRefType(), t.getRefId(),
          t.getReversalOfId() != null, t.getTotalDebit(), receivable, lines));
    }
    return new MemberStatement(rows, receivable);
  }

  @Transactional(readOnly = true)
  public LedgerIntegrity integrity() {
    String tenantId = TenantContext.get();
    long debit = entries.totalDebit(tenantId);
    long credit = entries.totalCredit(tenantId);
    return new LedgerIntegrity(debit, credit, debit == credit, transactions.count());
  }

  private Map<String, LedgerAccount> accountsById() {
    Map<String, LedgerAccount> byId = new HashMap<>();
    for (LedgerAccount a : accounts.findAll()) byId.put(a.getId(), a);
    return byId;
  }
}
