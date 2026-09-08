package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Append-only stock movement (INTENT.md M15) — the only way on-hand changes.
 * {@code qtyMilli} is a signed delta applied to {@code stockItemId} (transfers
 * record the source leg negative, the target leg positive). Each row snapshots
 * the on-hand / moving-average after applying and the signed stock-value delta
 * ({@code valueMilli}, minor×1000). Bound to the Prisma {@code StockMovement}.
 */
@Entity
@Table(name = "StockMovement")
public class StockMovement {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "stockItemId", nullable = false)
  private String stockItemId;

  @Column(name = "type", nullable = false)
  private String type; // purchase | sale | consumption | maintenance_use | adjustment | transfer

  @Column(name = "qtyMilli", nullable = false)
  private int qtyMilli;

  @Column(name = "qtyAfterMilli", nullable = false)
  private int qtyAfterMilli;

  @Column(name = "avgCostAfterMilli", nullable = false)
  private int avgCostAfterMilli;

  @Column(name = "valueMilli", nullable = false)
  private int valueMilli;

  @Column(name = "unitCostMilli")
  private Integer unitCostMilli;

  @Column(name = "saleId")
  private String saleId;

  @Column(name = "ticketId")
  private String ticketId;

  @Column(name = "stocktakeId")
  private String stocktakeId;

  @Column(name = "purchaseOrderId")
  private String purchaseOrderId;

  @Column(name = "targetItemId")
  private String targetItemId;

  @Column(name = "note")
  private String note;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected StockMovement() {}

  public StockMovement(String stockItemId, String type, int qtyMilli, int qtyAfterMilli,
      int avgCostAfterMilli, int valueMilli, String tenantId) {
    this.stockItemId = stockItemId;
    this.type = type;
    this.qtyMilli = qtyMilli;
    this.qtyAfterMilli = qtyAfterMilli;
    this.avgCostAfterMilli = avgCostAfterMilli;
    this.valueMilli = valueMilli;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getStockItemId() { return stockItemId; }
  public String getType() { return type; }
  public int getQtyMilli() { return qtyMilli; }
  public int getQtyAfterMilli() { return qtyAfterMilli; }
  public int getAvgCostAfterMilli() { return avgCostAfterMilli; }
  public int getValueMilli() { return valueMilli; }
  public Integer getUnitCostMilli() { return unitCostMilli; }
  public void setUnitCostMilli(Integer v) { this.unitCostMilli = v; }
  public String getSaleId() { return saleId; }
  public void setSaleId(String v) { this.saleId = v; }
  public String getTicketId() { return ticketId; }
  public void setTicketId(String v) { this.ticketId = v; }
  public String getStocktakeId() { return stocktakeId; }
  public void setStocktakeId(String v) { this.stocktakeId = v; }
  public String getPurchaseOrderId() { return purchaseOrderId; }
  public void setPurchaseOrderId(String v) { this.purchaseOrderId = v; }
  public String getTargetItemId() { return targetItemId; }
  public void setTargetItemId(String v) { this.targetItemId = v; }
  public String getNote() { return note; }
  public void setNote(String v) { this.note = v; }
  public String getCreatedById() { return createdById; }
  public void setCreatedById(String v) { this.createdById = v; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
}
