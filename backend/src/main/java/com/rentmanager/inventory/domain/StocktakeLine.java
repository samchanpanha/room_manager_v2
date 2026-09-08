package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** One counted line of a {@link Stocktake} (INTENT.md M15). Bound to {@code StocktakeLine}. */
@Entity
@Table(name = "StocktakeLine")
public class StocktakeLine {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "stocktakeId", nullable = false)
  private String stocktakeId;

  @Column(name = "stockItemId", nullable = false)
  private String stockItemId;

  @Column(name = "expectedMilli", nullable = false)
  private int expectedMilli;

  @Column(name = "countedMilli", nullable = false)
  private int countedMilli;

  @Column(name = "varianceMilli", nullable = false)
  private int varianceMilli;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected StocktakeLine() {}

  public StocktakeLine(String stocktakeId, String stockItemId, int expectedMilli,
      int countedMilli, int varianceMilli, String tenantId) {
    this.stocktakeId = stocktakeId;
    this.stockItemId = stockItemId;
    this.expectedMilli = expectedMilli;
    this.countedMilli = countedMilli;
    this.varianceMilli = varianceMilli;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getStocktakeId() { return stocktakeId; }
  public String getStockItemId() { return stockItemId; }
  public int getExpectedMilli() { return expectedMilli; }
  public int getCountedMilli() { return countedMilli; }
  public int getVarianceMilli() { return varianceMilli; }
  public String getTenantId() { return tenantId; }
}
