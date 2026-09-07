package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Invoice (INTENT.md M07). Bound to the existing Prisma {@code Invoice} table. */
@Entity
@Table(name = "Invoice")
public class Invoice {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "leaseId")
  private String leaseId;

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  @Column(name = "status", nullable = false)
  private String status = "draft"; // draft|issued|partial_paid|paid|overdue|void

  @Column(name = "periodStart", nullable = false)
  private Instant periodStart;

  @Column(name = "periodEnd", nullable = false)
  private Instant periodEnd;

  @Column(name = "issuedAt")
  private Instant issuedAt;

  @Column(name = "dueDate")
  private Instant dueDate;

  @Column(name = "subtotalMinor", nullable = false)
  private int subtotalMinor = 0;

  @Column(name = "discountMinor", nullable = false)
  private int discountMinor = 0;

  @Column(name = "taxMinor", nullable = false)
  private int taxMinor = 0;

  @Column(name = "totalMinor", nullable = false)
  private int totalMinor = 0;

  @Column(name = "amountPaidMinor", nullable = false)
  private int amountPaidMinor = 0;

  @Column(name = "amountCreditedMinor", nullable = false)
  private int amountCreditedMinor = 0;

  @Column(name = "amountDueMinor", nullable = false)
  private int amountDueMinor = 0;

  @Column(name = "dunningStage", nullable = false)
  private int dunningStage = 0;

  @Column(name = "voidReason")
  private String voidReason;

  @Column(name = "voidedAt")
  private Instant voidedAt;

  @Column(name = "notes")
  private String notes;

  @Column(name = "isDeposit", nullable = false)
  private boolean deposit = false;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "invoiceId")
  private List<InvoiceItem> items = new ArrayList<>();

  protected Invoice() {}

  public Invoice(String code, String propertyId, String memberProfileId,
      Instant periodStart, Instant periodEnd, String tenantId) {
    this.code = code;
    this.propertyId = propertyId;
    this.memberProfileId = memberProfileId;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  /**
   * Recompute subtotal / total / amountDue from the line items, payments and
   * credits — the single source of the derived-money rules shared by the
   * invoice (M07) and payment (M09) services. Mirrors {@code recomputeAmountsTx}
   * in {@code src/lib/billing/service.tsx}: total = subtotal − discount + tax;
   * amountDue = max(0, total − paid − credited).
   */
  public void recompute() {
    int subtotal = items.stream().mapToInt(InvoiceItem::getAmountMinor).sum();
    this.subtotalMinor = subtotal;
    this.totalMinor = subtotal - discountMinor + taxMinor;
    this.amountDueMinor = Math.max(0, totalMinor - amountPaidMinor - amountCreditedMinor);
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public void setCode(String c) { this.code = c; }
  public String getPropertyId() { return propertyId; }
  public String getLeaseId() { return leaseId; }
  public void setLeaseId(String v) { this.leaseId = v; }
  public String getMemberProfileId() { return memberProfileId; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public Instant getPeriodStart() { return periodStart; }
  public Instant getPeriodEnd() { return periodEnd; }
  public Instant getIssuedAt() { return issuedAt; }
  public void setIssuedAt(Instant v) { this.issuedAt = v; }
  public Instant getDueDate() { return dueDate; }
  public void setDueDate(Instant v) { this.dueDate = v; }
  public int getSubtotalMinor() { return subtotalMinor; }
  public void setSubtotalMinor(int v) { this.subtotalMinor = v; }
  public int getDiscountMinor() { return discountMinor; }
  public void setDiscountMinor(int v) { this.discountMinor = v; }
  public int getTaxMinor() { return taxMinor; }
  public void setTaxMinor(int v) { this.taxMinor = v; }
  public int getTotalMinor() { return totalMinor; }
  public void setTotalMinor(int v) { this.totalMinor = v; }
  public int getAmountPaidMinor() { return amountPaidMinor; }
  public void setAmountPaidMinor(int v) { this.amountPaidMinor = v; }
  public int getAmountCreditedMinor() { return amountCreditedMinor; }
  public void setAmountCreditedMinor(int v) { this.amountCreditedMinor = v; }
  public int getAmountDueMinor() { return amountDueMinor; }
  public void setAmountDueMinor(int v) { this.amountDueMinor = v; }
  public int getDunningStage() { return dunningStage; }
  public void setDunningStage(int v) { this.dunningStage = v; }
  public String getVoidReason() { return voidReason; }
  public void setVoidReason(String v) { this.voidReason = v; }
  public Instant getVoidedAt() { return voidedAt; }
  public void setVoidedAt(Instant v) { this.voidedAt = v; }
  public String getNotes() { return notes; }
  public void setNotes(String v) { this.notes = v; }
  public boolean isDeposit() { return deposit; }
  public void setDeposit(boolean v) { this.deposit = v; }
  public String getCreatedById() { return createdById; }
  public void setCreatedById(String v) { this.createdById = v; }
  public String getTenantId() { return tenantId; }
  public List<InvoiceItem> getItems() { return items; }
}
