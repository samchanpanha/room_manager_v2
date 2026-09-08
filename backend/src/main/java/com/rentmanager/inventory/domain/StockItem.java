package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Stock item (INTENT.md M15) — on-hand inventory tracked at moving-average cost.
 * Quantities are integer milli (1 unit = 1000); {@code avgCostMilli} is minor×1000.
 * On-hand ({@code qtyMilli}/{@code avgCostMilli}) only ever changes through a
 * {@link StockMovement}; the service never edits it directly. Bound to the
 * existing Prisma {@code StockItem} table.
 */
@Entity
@Table(name = "StockItem")
public class StockItem {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "category", nullable = false)
  private String category; // snapshotted path e.g. "Beverages/Cold"

  @Column(name = "categoryId")
  private String categoryId;

  @Column(name = "unit", nullable = false)
  private String unit; // pcs | kg | l | box …

  @Column(name = "packUnit")
  private String packUnit; // buy/pack unit e.g. "carton"

  @Column(name = "packSize")
  private Integer packSize; // e.g. 12 (1 carton = 12 unit)

  @Column(name = "qtyMilli", nullable = false)
  private int qtyMilli = 0;

  @Column(name = "avgCostMilli", nullable = false)
  private int avgCostMilli = 0;

  @Column(name = "minQtyMilli", nullable = false)
  private int minQtyMilli = 0;

  @Column(name = "imageDocId")
  private String imageDocId;

  @Column(name = "supplierId")
  private String supplierId;

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  protected StockItem() {}

  public StockItem(String name, String category, String unit, String propertyId, String tenantId) {
    this.name = name;
    this.category = category;
    this.unit = unit;
    this.propertyId = propertyId;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getCategory() { return category; }
  public void setCategory(String v) { this.category = v; }
  public String getCategoryId() { return categoryId; }
  public void setCategoryId(String v) { this.categoryId = v; }
  public String getUnit() { return unit; }
  public void setUnit(String v) { this.unit = v; }
  public String getPackUnit() { return packUnit; }
  public void setPackUnit(String v) { this.packUnit = v; }
  public Integer getPackSize() { return packSize; }
  public void setPackSize(Integer v) { this.packSize = v; }
  public int getQtyMilli() { return qtyMilli; }
  public void setQtyMilli(int v) { this.qtyMilli = v; }
  public int getAvgCostMilli() { return avgCostMilli; }
  public void setAvgCostMilli(int v) { this.avgCostMilli = v; }
  public int getMinQtyMilli() { return minQtyMilli; }
  public void setMinQtyMilli(int v) { this.minQtyMilli = v; }
  public String getImageDocId() { return imageDocId; }
  public String getSupplierId() { return supplierId; }
  public void setSupplierId(String v) { this.supplierId = v; }
  public String getPropertyId() { return propertyId; }
  public boolean isActive() { return active; }
  public void setActive(boolean v) { this.active = v; }
  public String getTenantId() { return tenantId; }
}
