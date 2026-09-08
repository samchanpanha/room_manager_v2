package com.rentmanager.finance.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Security deposit (INTENT.md M10). Bound to the existing Prisma {@code Deposit} table. */
@Entity
@Table(name = "Deposit")
public class Deposit {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "leaseId", nullable = false, unique = true)
  private String leaseId;

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  @Column(name = "propertyId")
  private String propertyId;

  @Column(name = "requiredMinor", nullable = false)
  private int requiredMinor;

  @Column(name = "status", nullable = false)
  private String status = "pending"; // pending|billed|held|settled

  @Column(name = "invoiceId", unique = true)
  private String invoiceId;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "depositId")
  private List<DepositTransaction> transactions = new ArrayList<>();

  protected Deposit() {}

  public Deposit(String leaseId, String memberProfileId, String propertyId,
      int requiredMinor, String tenantId) {
    this.leaseId = leaseId;
    this.memberProfileId = memberProfileId;
    this.propertyId = propertyId;
    this.requiredMinor = requiredMinor;
    this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getLeaseId() { return leaseId; }
  public String getMemberProfileId() { return memberProfileId; }
  public String getPropertyId() { return propertyId; }
  public int getRequiredMinor() { return requiredMinor; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public String getInvoiceId() { return invoiceId; }
  public void setInvoiceId(String v) { this.invoiceId = v; }
  public String getCreatedById() { return createdById; }
  public void setCreatedById(String v) { this.createdById = v; }
  public String getTenantId() { return tenantId; }
  public List<DepositTransaction> getTransactions() { return transactions; }

  /** Σ released (deductions + refunds) across settlement movements. */
  public int releasedMinor() {
    return transactions.stream().mapToInt(DepositTransaction::getAmountMinor).sum();
  }
}
