package com.rentmanager.finance.ledger.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, String> {

  /** Per-account debit/credit sums for the trial balance. */
  @Query("""
      select e.accountId as accountId, coalesce(sum(e.debit),0) as debit,
             coalesce(sum(e.credit),0) as credit
      from LedgerEntry e where e.tenantId = :tenantId group by e.accountId
      """)
  java.util.List<AccountSum> sumByAccount(@Param("tenantId") String tenantId);

  @Query("select coalesce(sum(e.debit),0) from LedgerEntry e where e.tenantId = :tenantId")
  long totalDebit(@Param("tenantId") String tenantId);

  @Query("select coalesce(sum(e.credit),0) from LedgerEntry e where e.tenantId = :tenantId")
  long totalCredit(@Param("tenantId") String tenantId);

  /** Projection for {@link #sumByAccount}. */
  interface AccountSum {
    String getAccountId();
    long getDebit();
    long getCredit();
  }
}
