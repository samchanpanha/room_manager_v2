package com.rentmanager.commerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class OpenSessionRequest {
    @NotBlank
    private String propertyId;

    @PositiveOrZero
    private int openingCashMinor;

    private String notes;

    public OpenSessionRequest() {}

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }
    public int getOpeningCashMinor() { return openingCashMinor; }
    public void setOpeningCashMinor(int openingCashMinor) { this.openingCashMinor = openingCashMinor; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
