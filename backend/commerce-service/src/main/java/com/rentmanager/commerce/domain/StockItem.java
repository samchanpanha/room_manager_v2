package com.rentmanager.commerce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"StockItem\"")
public class StockItem {

    @Id
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "category", nullable = false)
    private String category = "General";

    @Column(name = "unit", nullable = false)
    private String unit = "pcs";

    @Column(name = "\"qtyMilli\"", nullable = false)
    private int qtyMilli = 0;

    @Column(name = "\"avgCostMilli\"", nullable = false)
    private int avgCostMilli = 0;

    @Column(name = "\"minQtyMilli\"", nullable = false)
    private int minQtyMilli = 0;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"isActive\"", nullable = false)
    private boolean isActive = true;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public StockItem() {}

    public StockItem(String id, String name, String category, String unit, String propertyId) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.unit = unit;
        this.propertyId = propertyId;
        this.qtyMilli = 0;
        this.isActive = true;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public int getQtyMilli() { return qtyMilli; }
    public void setQtyMilli(int qtyMilli) { this.qtyMilli = qtyMilli; }

    public int getAvgCostMilli() { return avgCostMilli; }
    public void setAvgCostMilli(int avgCostMilli) { this.avgCostMilli = avgCostMilli; }

    public int getMinQtyMilli() { return minQtyMilli; }
    public void setMinQtyMilli(int minQtyMilli) { this.minQtyMilli = minQtyMilli; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
