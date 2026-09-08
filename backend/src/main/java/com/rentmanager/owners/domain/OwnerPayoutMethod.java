package com.rentmanager.owners.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Owner payout destination. Bound to Prisma {@code OwnerPayoutMethod}. */
@Entity
@Table(name = "OwnerPayoutMethod")
public class OwnerPayoutMethod {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "ownerProfileId", nullable = false)
  private String ownerProfileId;

  @Column(name = "kind", nullable = false)
  private String kind; // BANK | MOBILE_MONEY | CASH | OTHER

  @Column(name = "bankName")
  private String bankName;

  @Column(name = "accountName", nullable = false)
  private String accountName;

  @Column(name = "accountNumber", nullable = false)
  private String accountNumber;

  @Column(name = "isPrimary", nullable = false)
  private boolean primary = false;

  @Column(name = "notes")
  private String notes;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected OwnerPayoutMethod() {}

  public OwnerPayoutMethod(String kind, String bankName, String accountName,
      String accountNumber, boolean primary, String tenantId) {
    this.kind = kind;
    this.bankName = bankName;
    this.accountName = accountName;
    this.accountNumber = accountNumber;
    this.primary = primary;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getKind() { return kind; }
  public String getBankName() { return bankName; }
  public String getAccountName() { return accountName; }
  public String getAccountNumber() { return accountNumber; }
  public boolean isPrimary() { return primary; }
}
