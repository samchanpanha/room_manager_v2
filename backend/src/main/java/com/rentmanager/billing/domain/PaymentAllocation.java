package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Payment→Invoice allocation (M09). Bound to Prisma {@code PaymentAllocation}. */
@Entity
@Table(name = "PaymentAllocation")
public class PaymentAllocation {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "paymentId", nullable = false)
  private String paymentId;

  @Column(name = "invoiceId", nullable = false)
  private String invoiceId;

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected PaymentAllocation() {}

  public PaymentAllocation(String invoiceId, int amountMinor, String tenantId) {
    this.invoiceId = invoiceId;
    this.amountMinor = amountMinor;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getInvoiceId() { return invoiceId; }
  public int getAmountMinor() { return amountMinor; }
  public String getTenantId() { return tenantId; }
}
