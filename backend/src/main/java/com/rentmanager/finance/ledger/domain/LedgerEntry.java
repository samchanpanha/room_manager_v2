package com.rentmanager.finance.ledger.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Ledger entry line (INTENT.md M08). Bound to Prisma {@code LedgerEntry}. */
@Entity
@Table(name = "LedgerEntry")
public class LedgerEntry {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  // Written by the LedgerTransaction @OneToMany @JoinColumn; mapped read-only
  // here so the FK is still readable without a second insert/update mapping.
  @Column(name = "transactionId", nullable = false, insertable = false, updatable = false)
  private String transactionId;

  @Column(name = "accountId", nullable = false)
  private String accountId;

  @Column(name = "debit", nullable = false)
  private int debit = 0;

  @Column(name = "credit", nullable = false)
  private int credit = 0;

  @Column(name = "memo")
  private String memo;

  @Column(name = "propertyId")
  private String propertyId;

  @Column(name = "memberId")
  private String memberId;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected LedgerEntry() {}

  public LedgerEntry(String accountId, int debit, int credit, String memo,
      String propertyId, String memberId, String tenantId) {
    this.accountId = accountId;
    this.debit = debit;
    this.credit = credit;
    this.memo = memo;
    this.propertyId = propertyId;
    this.memberId = memberId;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getAccountId() { return accountId; }
  public int getDebit() { return debit; }
  public int getCredit() { return credit; }
  public String getMemo() { return memo; }
}
