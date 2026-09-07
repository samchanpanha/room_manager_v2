package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Credit note against an invoice (M07). Bound to Prisma {@code CreditNote}. */
@Entity
@Table(name = "CreditNote")
public class CreditNote {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "invoiceId", nullable = false)
  private String invoiceId;

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "reason", nullable = false)
  private String reason;

  @Column(name = "issuedAt", nullable = false)
  private Instant issuedAt = Instant.now();

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected CreditNote() {}

  public CreditNote(String code, String invoiceId, int amountMinor, String reason,
      String createdById, String tenantId) {
    this.code = code;
    this.invoiceId = invoiceId;
    this.amountMinor = amountMinor;
    this.reason = reason;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public int getAmountMinor() { return amountMinor; }
  public String getReason() { return reason; }
}
