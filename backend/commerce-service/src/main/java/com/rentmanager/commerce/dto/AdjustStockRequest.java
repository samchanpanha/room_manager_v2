package com.rentmanager.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AdjustStockRequest {
    @NotBlank
    private String type; // purchase | sale | consumption | maintenance_use | adjustment | transfer

    @NotNull
    private Integer deltaQtyMilli; // positive to add, negative to subtract

    private Integer unitCostMilli;

    private String saleId;

    public AdjustStockRequest() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Integer getDeltaQtyMilli() { return deltaQtyMilli; }
    public void setDeltaQtyMilli(Integer deltaQtyMilli) { this.deltaQtyMilli = deltaQtyMilli; }
    public Integer getUnitCostMilli() { return unitCostMilli; }
    public void setUnitCostMilli(Integer unitCostMilli) { this.unitCostMilli = unitCostMilli; }
    public String getSaleId() { return saleId; }
    public void setSaleId(String saleId) { this.saleId = saleId; }
}
