package com.rentmanager.commerce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"StockMovement\"")
public class StockMovement {

    @Id
    private String id;

    @Column(name = "\"stockItemId\"", nullable = false)
    private String stockItemId;

    @Column(name = "type", nullable = false)
    private String type; // purchase | sale | consumption | maintenance_use | adjustment | transfer

    @Column(name = "\"qtyMilli\"", nullable = false)
    private int qtyMilli;

    @Column(name = "\"qtyAfterMilli\"", nullable = false)
    private int qtyAfterMilli;

    @Column(name = "\"avgCostAfterMilli\"", nullable = false)
    private int avgCostAfterMilli = 0;

    @Column(name = "\"valueMilli\"", nullable = false)
    private int valueMilli = 0;

    @Column(name = "\"saleId\"")
    private String saleId;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public StockMovement() {}

    public StockMovement(String id, String stockItemId, String type, int qtyMilli, int qtyAfterMilli) {
        this.id = id;
        this.stockItemId = stockItemId;
        this.type = type;
        this.qtyMilli = qtyMilli;
        this.qtyAfterMilli = qtyAfterMilli;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStockItemId() { return stockItemId; }
    public void setStockItemId(String stockItemId) { this.stockItemId = stockItemId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public int getQtyMilli() { return qtyMilli; }
    public void setQtyMilli(int qtyMilli) { this.qtyMilli = qtyMilli; }

    public int getQtyAfterMilli() { return qtyAfterMilli; }
    public void setQtyAfterMilli(int qtyAfterMilli) { this.qtyAfterMilli = qtyAfterMilli; }

    public int getAvgCostAfterMilli() { return avgCostAfterMilli; }
    public void setAvgCostAfterMilli(int avgCostAfterMilli) { this.avgCostAfterMilli = avgCostAfterMilli; }

    public int getValueMilli() { return valueMilli; }
    public void setValueMilli(int valueMilli) { this.valueMilli = valueMilli; }

    public String getSaleId() { return saleId; }
    public void setSaleId(String saleId) { this.saleId = saleId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
