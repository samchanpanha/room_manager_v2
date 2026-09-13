package com.rentmanager.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

public class CreateSaleRequest {
    @NotBlank
    private String sessionId;

    @NotBlank
    private String propertyId;

    @NotBlank
    private String method; // cash | qr | card | room_charge

    @PositiveOrZero
    private int discountMinor = 0;

    private String memberProfileId;

    @NotEmpty
    @Valid
    private List<SaleItemRequest> items;

    public CreateSaleRequest() {}

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public int getDiscountMinor() { return discountMinor; }
    public void setDiscountMinor(int discountMinor) { this.discountMinor = discountMinor; }
    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }
    public List<SaleItemRequest> getItems() { return items; }
    public void setItems(List<SaleItemRequest> items) { this.items = items; }
}
