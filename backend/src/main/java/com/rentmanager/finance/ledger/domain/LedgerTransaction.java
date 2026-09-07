package com.rentmanager.finance.ledger.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Ledger transaction (INTENT.md M08). Bound to Prisma {@code LedgerTransaction}. */
@Entity
@Table(name = "LedgerTransaction")
public class LedgerTransaction {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "postedAt", nullable = false)
  private Instant postedAt = Instant.now();

  @Column(name = "memo", nullable = false)
  private String memo;

  @Column(name = "refType", nullable = false)
  private String refType;

  @Column(name = "refId")
  private String refId;

  @Column(name = "propertyId")
  private String propertyId;

  @Column(name = "memberId")
  private String memberId;

  @Column(name = "totalDebit", nullable = false)
  private int totalDebit;

  @Column(name = "totalCredit", nullable = false)
  private int totalCredit;

  @Column(name = "reversalOfId")
  private String reversalOfId;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "transactionId")
  private List<LedgerEntry> entries = new ArrayList<>();

  protected LedgerTransaction() {}

  public LedgerTransaction(String memo, String refType, String refId, String propertyId,
      String memberId, int totalDebit, String reversalOfId, String createdById, String tenantId) {
    this.memo = memo;
    this.refType = refType;
    this.refId = refId;
    this.propertyId = propertyId;
    this.memberId = memberId;
    this.totalDebit = totalDebit;
    this.totalCredit = totalDebit;
    this.reversalOfId = reversalOfId;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public Instant getPostedAt() { return postedAt; }
  public String getMemo() { return memo; }
  public String getRefType() { return refType; }
  public String getRefId() { return refId; }
  public String getPropertyId() { return propertyId; }
  public String getMemberId() { return memberId; }
  public int getTotalDebit() { return totalDebit; }
  public int getTotalCredit() { return totalCredit; }
  public String getReversalOfId() { return reversalOfId; }
  public String getTenantId() { return tenantId; }
  public List<LedgerEntry> getEntries() { return entries; }
}
