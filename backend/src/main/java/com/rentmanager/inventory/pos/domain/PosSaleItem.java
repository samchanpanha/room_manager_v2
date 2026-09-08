package com.rentmanager.inventory.pos.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/** One line of a {@link PosSale} (INTENT.md M14), with product/price snapshots. */
@Entity
@Table(name = "PosSaleItem")
public class PosSaleItem {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "saleId", nullable = false)
  private String saleId;

  @Column(name = "productId", nullable = false)
  private String productId;

  @Column(name = "name", nullable = false)
  private String name; // snapshot

  @Column(name = "qtyMilli", nullable = false)
  private int qtyMilli;

  @Column(name = "unitPriceMinor", nullable = false)
  private int unitPriceMinor;

  @Column(name = "lineMinor", nullable = false)
  private int lineMinor;

  @Column(name = "stockItemId")
  private String stockItemId; // snapshot of the product's stock link at sale time

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected PosSaleItem() {}

  public PosSaleItem(String productId, String name, int qtyMilli, int unitPriceMinor,
      int lineMinor, String stockItemId, String tenantId) {
    this.productId = productId;
    this.name = name;
    this.qtyMilli = qtyMilli;
    this.unitPriceMinor = unitPriceMinor;
    this.lineMinor = lineMinor;
    this.stockItemId = stockItemId;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getSaleId() { return saleId; }
  public void setSaleId(String v) { this.saleId = v; }
  public String getProductId() { return productId; }
  public String getName() { return name; }
  public int getQtyMilli() { return qtyMilli; }
  public int getUnitPriceMinor() { return unitPriceMinor; }
  public int getLineMinor() { return lineMinor; }
  public String getStockItemId() { return stockItemId; }
  public String getTenantId() { return tenantId; }
}
