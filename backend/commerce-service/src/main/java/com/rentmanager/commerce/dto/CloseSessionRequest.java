package com.rentmanager.commerce.dto;

import jakarta.validation.constraints.PositiveOrZero;

public class CloseSessionRequest {
    @PositiveOrZero
    private int actualCashMinor;

    private String notes;

    public CloseSessionRequest() {}

    public int getActualCashMinor() { return actualCashMinor; }
    public void setActualCashMinor(int actualCashMinor) { this.actualCashMinor = actualCashMinor; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
