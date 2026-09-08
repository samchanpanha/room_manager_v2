package com.rentmanager.inventory.pos.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * POS product (INTENT.md M14) — a priced sellable item that optionally links a
 * {@code StockItem} (M15) so sales decrement on-hand. Global catalog (name +
 * barcode unique). Bound to the existing Prisma {@code PosProduct} table.
 */
@Entity
@Table(name = "PosProduct")
public class PosProduct {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "name", nullable = false, unique = true)
  private String name;

  @Column(name = "priceMinor", nullable = false)
  private int priceMinor;

  @Column(name = "category")
  private String category; // snapshotted path — mirror of categoryId

  @Column(name = "categoryId")
  private String categoryId;

  @Column(name = "barcode", unique = true)
  private String barcode; // EAN-13

  @Column(name = "sku")
  private String sku;

  @Column(name = "description")
  private String description;

  @Column(name = "imageDocId")
  private String imageDocId;

  @Column(name = "stockItemId")
  private String stockItemId; // sales decrement this stock item

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  protected PosProduct() {}

  public PosProduct(String name, int priceMinor) {
    this.name = name;
    this.priceMinor = priceMinor;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public int getPriceMinor() { return priceMinor; }
  public void setPriceMinor(int v) { this.priceMinor = v; }
  public String getCategory() { return category; }
  public void setCategory(String v) { this.category = v; }
  public String getCategoryId() { return categoryId; }
  public void setCategoryId(String v) { this.categoryId = v; }
  public String getBarcode() { return barcode; }
  public void setBarcode(String v) { this.barcode = v; }
  public String getSku() { return sku; }
  public void setSku(String v) { this.sku = v; }
  public String getDescription() { return description; }
  public void setDescription(String v) { this.description = v; }
  public String getImageDocId() { return imageDocId; }
  public String getStockItemId() { return stockItemId; }
  public void setStockItemId(String v) { this.stockItemId = v; }
  public boolean isActive() { return active; }
  public void setActive(boolean v) { this.active = v; }
}
