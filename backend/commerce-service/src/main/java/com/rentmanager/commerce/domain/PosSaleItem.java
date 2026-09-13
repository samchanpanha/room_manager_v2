package com.rentmanager.commerce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"PosSaleItem\"")
public class PosSaleItem {

    @Id
    private String id;

    @Column(name = "\"saleId\"", nullable = false)
    private String saleId;

    @Column(name = "\"productId\"", nullable = false)
    private String productId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "\"qtyMilli\"", nullable = false)
    private int qtyMilli;

    @Column(name = "\"unitPriceMinor\"", nullable = false)
    private int unitPriceMinor;

    @Column(name = "\"lineMinor\"", nullable = false)
    private int lineMinor;

    @Column(name = "\"stockItemId\"")
    private String stockItemId;

    public PosSaleItem() {}

    public PosSaleItem(String id, String saleId, String productId, String name, int qtyMilli, int unitPriceMinor, int lineMinor) {
        this.id = id;
        this.saleId = saleId;
        this.productId = productId;
        this.name = name;
        this.qtyMilli = qtyMilli;
        this.unitPriceMinor = unitPriceMinor;
        this.lineMinor = lineMinor;
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
