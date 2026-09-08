package com.rentmanager.services.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Per-use entry (laundry kg, visitor parking…) that rides the lease's next
 * invoice as a one-time {@code service} line (INTENT.md M12). Pending until
 * billed; a voided invoice reverts it to pending. Bound to {@code ServiceUsage}.
 */
@Entity
@Table(name = "ServiceUsage")
public class ServiceUsage {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "serviceId", nullable = false)
  private String serviceId;

  @Column(name = "leaseId", nullable = false)
  private String leaseId;

  @Column(name = "qtyMilli", nullable = false)
  private int qtyMilli;

  @Column(name = "unitLabel")
  private String unitLabel;

  @Column(name = "unitPriceMinor", nullable = false)
  private int unitPriceMinor;

  @Column(name = "usedAt", nullable = false)
  private Instant usedAt;

  @Column(name = "status", nullable = false)
  private String status = "pending"; // pending | billed

  @Column(name = "invoiceId")
  private String invoiceId;

  @Column(name = "invoiceItemId")
  private String invoiceItemId;

  @Column(name = "note")
  private String note;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected ServiceUsage() {}

  public ServiceUsage(String serviceId, String leaseId, int qtyMilli, String unitLabel,
      int unitPriceMinor, Instant usedAt, String note, String createdById, String tenantId) {
    this.serviceId = serviceId;
    this.leaseId = leaseId;
    this.qtyMilli = qtyMilli;
    this.unitLabel = unitLabel;
    this.unitPriceMinor = unitPriceMinor;
    this.usedAt = usedAt;
    this.note = note;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getServiceId() { return serviceId; }
  public String getLeaseId() { return leaseId; }
  public int getQtyMilli() { return qtyMilli; }
  public String getUnitLabel() { return unitLabel; }
  public int getUnitPriceMinor() { return unitPriceMinor; }
  public Instant getUsedAt() { return usedAt; }
  public String getStatus() { return status; }
  public String getInvoiceId() { return invoiceId; }

  /** Computed amount = round(unitPrice × qty / 1000) minor units. */
  public int amountMinor() {
    return (int) Math.round((double) unitPriceMinor * qtyMilli / 1000.0);
  }

  public void markBilled(String invoiceId, String invoiceItemId) {
    this.status = "billed";
    this.invoiceId = invoiceId;
    this.invoiceItemId = invoiceItemId;
  }

  public void revertToPending() {
    this.status = "pending";
    this.invoiceId = null;
    this.invoiceItemId = null;
  }
}
