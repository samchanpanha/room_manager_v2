package com.rentmanager.commerce.dto;

import com.rentmanager.commerce.domain.StockItem;

import java.time.Instant;

public class StockItemDto {
    private String id;
    private String name;
    private String category;
    private String unit;
    private int qtyMilli;
    private int avgCostMilli;
    private int minQtyMilli;
    private String propertyId;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public StockItemDto() {}

    public StockItemDto(StockItem item) {
        this.id = item.getId();
        this.name = item.getName();
        this.category = item.getCategory();
        this.unit = item.getUnit();
        this.qtyMilli = item.getQtyMilli();
        this.avgCostMilli = item.getAvgCostMilli();
        this.minQtyMilli = item.getMinQtyMilli();
        this.propertyId = item.getPropertyId();
        this.active = item.isActive();
        this.createdAt = item.getCreatedAt();
        this.updatedAt = item.getUpdatedAt();
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
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
