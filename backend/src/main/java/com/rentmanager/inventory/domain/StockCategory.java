package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Stock category (INTENT.md M15) — two-level parent/child hierarchy.
 * {@code propertyId} is nullable: null = shared/global categories (POS
 * products), set = that property's stock categories. Bound to the existing
 * Prisma {@code StockCategory} table.
 */
@Entity
@Table(name = "StockCategory")
public class StockCategory {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "propertyId")
  private String propertyId; // null = shared

  @Column(name = "parentId")
  private String parentId;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "sortOrder", nullable = false)
  private int sortOrder = 0;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  protected StockCategory() {}

  public StockCategory(String name, String parentId, String propertyId) {
    this.name = name;
    this.parentId = parentId;
    this.propertyId = propertyId;
  }

  public String getId() { return id; }
  public String getPropertyId() { return propertyId; }
  public String getParentId() { return parentId; }
  public void setParentId(String v) { this.parentId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public int getSortOrder() { return sortOrder; }
  public void setSortOrder(int v) { this.sortOrder = v; }
  public boolean isActive() { return active; }
  public void setActive(boolean v) { this.active = v; }
}
