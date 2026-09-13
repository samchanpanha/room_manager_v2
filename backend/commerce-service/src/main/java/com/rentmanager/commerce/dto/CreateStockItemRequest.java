package com.rentmanager.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class CreateStockItemRequest {
    @NotBlank
    private String name;

    private String category = "General";
    private String unit = "pcs";

    @PositiveOrZero
    private int initialQtyMilli = 0;

    @PositiveOrZero
    private int avgCostMilli = 0;

    @PositiveOrZero
    private int minQtyMilli = 0;

    @NotBlank
    private String propertyId;

    public CreateStockItemRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public int getInitialQtyMilli() { return initialQtyMilli; }
    public void setInitialQtyMilli(int initialQtyMilli) { this.initialQtyMilli = initialQtyMilli; }
    public int getAvgCostMilli() { return avgCostMilli; }
    public void setAvgCostMilli(int avgCostMilli) { this.avgCostMilli = avgCostMilli; }
    public int getMinQtyMilli() { return minQtyMilli; }
    public void setMinQtyMilli(int minQtyMilli) { this.minQtyMilli = minQtyMilli; }
    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }
}
