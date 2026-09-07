package com.rentmanager.finance.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Deposit settlement movement (M10). Bound to Prisma {@code DepositTransaction}. */
@Entity
@Table(name = "DepositTransaction")
public class DepositTransaction {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "depositId", nullable = false)
  private String depositId;

  @Column(name = "type", nullable = false)
  private String type; // deduction|refund

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "reason")
  private String reason; // damage|cleaning|unpaid_rent|other (deductions)

  @Column(name = "evidenceDocId")
  private String evidenceDocId; // M17 registry id — required for deductions

  @Column(name = "note", nullable = false)
  private String note;

  @Column(name = "method")
  private String method; // refund settlement method

  @Column(name = "ledgerTxId")
  private String ledgerTxId;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected DepositTransaction() {}

  public DepositTransaction(String type, int amountMinor, String reason, String evidenceDocId,
      String note, String method, String createdById, String tenantId) {
    this.type = type;
    this.amountMinor = amountMinor;
    this.reason = reason;
    this.evidenceDocId = evidenceDocId;
    this.note = note;
    this.method = method;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getType() { return type; }
  public int getAmountMinor() { return amountMinor; }
  public String getReason() { return reason; }
  public String getEvidenceDocId() { return evidenceDocId; }
  public String getNote() { return note; }
  public String getMethod() { return method; }
  public void setLedgerTxId(String v) { this.ledgerTxId = v; }
}
