package com.rentmanager.utilities.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Computed charge for one reading (INTENT.md M11): (reading − previous) ×
 * tariff. Pending charges attach to the lease's next generated invoice and flip
 * to {@code billed}; voiding that invoice reverts them to pending. Bound to
 * Prisma {@code UtilityCharge}.
 */
@Entity
@Table(name = "UtilityCharge")
public class UtilityCharge {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "leaseId", nullable = false)
  private String leaseId;

  @Column(name = "roomId", nullable = false)
  private String roomId;

  @Column(name = "meterId", nullable = false)
  private String meterId;

  @Column(name = "readingId", nullable = false, unique = true)
  private String readingId;

  @Column(name = "periodStart", nullable = false)
  private Instant periodStart;

  @Column(name = "periodEnd", nullable = false)
  private Instant periodEnd;

  @Column(name = "consumptionMilli", nullable = false)
  private int consumptionMilli;

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "tariffName", nullable = false)
  private String tariffName;

  @Column(name = "status", nullable = false)
  private String status = "pending"; // pending | billed

  @Column(name = "invoiceId")
  private String invoiceId;

  @Column(name = "invoiceItemId")
  private String invoiceItemId;

  @Column(name = "anomaly", nullable = false)
  private boolean anomaly = false;

  @Column(name = "note")
  private String note;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected UtilityCharge() {}

  public UtilityCharge(String leaseId, String roomId, String meterId, String readingId,
      Instant periodStart, Instant periodEnd, int consumptionMilli, int amountMinor,
      String tariffName, boolean anomaly, String note, String tenantId) {
    this.leaseId = leaseId;
    this.roomId = roomId;
    this.meterId = meterId;
    this.readingId = readingId;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.consumptionMilli = consumptionMilli;
    this.amountMinor = amountMinor;
    this.tariffName = tariffName;
    this.anomaly = anomaly;
    this.note = note;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getLeaseId() { return leaseId; }
  public String getMeterId() { return meterId; }
  public Instant getPeriodStart() { return periodStart; }
  public Instant getPeriodEnd() { return periodEnd; }
  public int getConsumptionMilli() { return consumptionMilli; }
  public int getAmountMinor() { return amountMinor; }
  public String getTariffName() { return tariffName; }
  public String getStatus() { return status; }
  public String getInvoiceId() { return invoiceId; }
  public boolean isAnomaly() { return anomaly; }

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
