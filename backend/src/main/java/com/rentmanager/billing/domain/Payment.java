package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Payment (INTENT.md M09). Bound to the existing Prisma {@code Payment} table. */
@Entity
@Table(name = "Payment")
public class Payment {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code; // PMT-2026-0001

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  @Column(name = "propertyId")
  private String propertyId;

  @Column(name = "method", nullable = false)
  private String method; // cash|bank_transfer|qr|card|cheque

  @Column(name = "status", nullable = false)
  private String status = "pending"; // pending|confirmed|refunded|failed

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "remainingMinor", nullable = false)
  private int remainingMinor = 0;

  @Column(name = "refundedMinor", nullable = false)
  private int refundedMinor = 0;

  @Column(name = "gatewayRef", unique = true)
  private String gatewayRef;

  @Column(name = "idempotencyKey", unique = true)
  private String idempotencyKey;

  @Column(name = "failReason")
  private String failReason;

  @Column(name = "refundReason")
  private String refundReason;

  @Column(name = "receiptCode", unique = true)
  private String receiptCode; // RCP-2026-0001

  @Column(name = "receivedAt", nullable = false)
  private Instant receivedAt = Instant.now();

  @Column(name = "confirmedAt")
  private Instant confirmedAt;

  @Column(name = "refundedAt")
  private Instant refundedAt;

  @Column(name = "failedAt")
  private Instant failedAt;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "paymentId")
  private List<PaymentAllocation> allocations = new ArrayList<>();

  protected Payment() {}

  public Payment(String code, String memberProfileId, String propertyId, String method,
      int amountMinor, String tenantId) {
    this.code = code;
    this.memberProfileId = memberProfileId;
    this.propertyId = propertyId;
    this.method = method;
    this.amountMinor = amountMinor;
    this.remainingMinor = amountMinor;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getMemberProfileId() { return memberProfileId; }
  public String getPropertyId() { return propertyId; }
  public void setPropertyId(String v) { this.propertyId = v; }
  public String getMethod() { return method; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public int getAmountMinor() { return amountMinor; }
  public int getRemainingMinor() { return remainingMinor; }
  public void setRemainingMinor(int v) { this.remainingMinor = v; }
  public int getRefundedMinor() { return refundedMinor; }
  public void setRefundedMinor(int v) { this.refundedMinor = v; }
  public String getGatewayRef() { return gatewayRef; }
  public void setGatewayRef(String v) { this.gatewayRef = v; }
  public String getIdempotencyKey() { return idempotencyKey; }
  public void setIdempotencyKey(String v) { this.idempotencyKey = v; }
  public String getFailReason() { return failReason; }
  public void setFailReason(String v) { this.failReason = v; }
  public String getRefundReason() { return refundReason; }
  public void setRefundReason(String v) { this.refundReason = v; }
  public String getReceiptCode() { return receiptCode; }
  public void setReceiptCode(String v) { this.receiptCode = v; }
  public Instant getReceivedAt() { return receivedAt; }
  public void setReceivedAt(Instant v) { this.receivedAt = v; }
  public Instant getConfirmedAt() { return confirmedAt; }
  public void setConfirmedAt(Instant v) { this.confirmedAt = v; }
  public Instant getRefundedAt() { return refundedAt; }
  public void setRefundedAt(Instant v) { this.refundedAt = v; }
  public Instant getFailedAt() { return failedAt; }
  public void setFailedAt(Instant v) { this.failedAt = v; }
  public String getCreatedById() { return createdById; }
  public void setCreatedById(String v) { this.createdById = v; }
  public String getTenantId() { return tenantId; }
  public List<PaymentAllocation> getAllocations() { return allocations; }

  public int allocatedMinor() { return amountMinor - remainingMinor; }
}
