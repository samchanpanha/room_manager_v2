package com.rentmanager.commerce.dto;

import com.rentmanager.commerce.domain.PosSaleItem;

public class SaleItemDto {
    private String id;
    private String saleId;
    private String productId;
    private String name;
    private int qtyMilli;
    private int unitPriceMinor;
    private int lineMinor;
    private String stockItemId;

    public SaleItemDto() {}

    public SaleItemDto(PosSaleItem item) {
        this.id = item.getId();
        this.saleId = item.getSaleId();
        this.productId = item.getProductId();
        this.name = item.getName();
        this.qtyMilli = item.getQtyMilli();
        this.unitPriceMinor = item.getUnitPriceMinor();
        this.lineMinor = item.getLineMinor();
        this.stockItemId = item.getStockItemId();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSaleId() { return saleId; }
    public void setSaleId(String saleId) { this.saleId = saleId; }
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getQtyMilli() { return qtyMilli; }
    public void setQtyMilli(int qtyMilli) { this.qtyMilli = qtyMilli; }
    public int getUnitPriceMinor() { return unitPriceMinor; }
    public void setUnitPriceMinor(int unitPriceMinor) { this.unitPriceMinor = unitPriceMinor; }
    public int getLineMinor() { return lineMinor; }
    public void setLineMinor(int lineMinor) { this.lineMinor = lineMinor; }
    public String getStockItemId() { return stockItemId; }
    public void setStockItemId(String stockItemId) { this.stockItemId = stockItemId; }
}
