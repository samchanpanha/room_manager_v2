package com.rentmanager.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public class SaleItemRequest {
    @NotBlank
    private String productId;

    @NotBlank
    private String name;

    @Positive
    private int qtyMilli;

    @PositiveOrZero
    private int unitPriceMinor;

    private String stockItemId;

    public SaleItemRequest() {}

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getQtyMilli() { return qtyMilli; }
    public void setQtyMilli(int qtyMilli) { this.qtyMilli = qtyMilli; }
    public int getUnitPriceMinor() { return unitPriceMinor; }
    public void setUnitPriceMinor(int unitPriceMinor) { this.unitPriceMinor = unitPriceMinor; }
    public String getStockItemId() { return stockItemId; }
    public void setStockItemId(String stockItemId) { this.stockItemId = stockItemId; }
}
