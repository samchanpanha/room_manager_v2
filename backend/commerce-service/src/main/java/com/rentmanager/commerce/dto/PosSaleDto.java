package com.rentmanager.commerce.dto;

import com.rentmanager.commerce.domain.PosSale;

import java.time.Instant;
import java.util.List;

public class PosSaleDto {
    private String id;
    private String code;
    private String sessionId;
    private String propertyId;
    private String method;
    private int totalMinor;
    private int discountMinor;
    private String memberProfileId;
    private String invoiceId;
    private String soldById;
    private Instant createdAt;
    private List<SaleItemDto> items;

    public PosSaleDto() {}

    public PosSaleDto(PosSale sale, List<SaleItemDto> items) {
        this.id = sale.getId();
        this.code = sale.getCode();
        this.sessionId = sale.getSessionId();
        this.propertyId = sale.getPropertyId();
        this.method = sale.getMethod();
        this.totalMinor = sale.getTotalMinor();
        this.discountMinor = sale.getDiscountMinor();
        this.memberProfileId = sale.getMemberProfileId();
        this.invoiceId = sale.getInvoiceId();
        this.soldById = sale.getSoldById();
        this.createdAt = sale.getCreatedAt();
        this.items = items;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public int getTotalMinor() { return totalMinor; }
    public void setTotalMinor(int totalMinor) { this.totalMinor = totalMinor; }
    public int getDiscountMinor() { return discountMinor; }
    public void setDiscountMinor(int discountMinor) { this.discountMinor = discountMinor; }
    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }
    public String getInvoiceId() { return invoiceId; }
    public void setInvoiceId(String invoiceId) { this.invoiceId = invoiceId; }
    public String getSoldById() { return soldById; }
    public void setSoldById(String soldById) { this.soldById = soldById; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public List<SaleItemDto> getItems() { return items; }
    public void setItems(List<SaleItemDto> items) { this.items = items; }
}
