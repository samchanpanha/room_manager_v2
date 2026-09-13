package com.rentmanager.commerce.dto;

import com.rentmanager.commerce.domain.PosSession;

import java.time.Instant;

public class PosSessionDto {
    private String id;
    private String code;
    private String propertyId;
    private String openedById;
    private Instant openedAt;
    private String closedById;
    private Instant closedAt;
    private int openingCashMinor;
    private int expectedCashMinor;
    private int actualCashMinor;
    private int cashDiffMinor;
    private String status;
    private String notes;

    public PosSessionDto() {}

    public PosSessionDto(PosSession s) {
        this.id = s.getId();
        this.code = s.getCode();
        this.propertyId = s.getPropertyId();
        this.openedById = s.getOpenedById();
        this.openedAt = s.getOpenedAt();
        this.closedById = s.getClosedById();
        this.closedAt = s.getClosedAt();
        this.openingCashMinor = s.getOpeningCashMinor();
        this.expectedCashMinor = s.getExpectedCashMinor();
        this.actualCashMinor = s.getActualCashMinor();
        this.cashDiffMinor = s.getCashDiffMinor();
        this.status = s.getStatus();
        this.notes = s.getNotes();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }
    public String getOpenedById() { return openedById; }
    public void setOpenedById(String openedById) { this.openedById = openedById; }
    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }
    public String getClosedById() { return closedById; }
    public void setClosedById(String closedById) { this.closedById = closedById; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public int getOpeningCashMinor() { return openingCashMinor; }
    public void setOpeningCashMinor(int openingCashMinor) { this.openingCashMinor = openingCashMinor; }
    public int getExpectedCashMinor() { return expectedCashMinor; }
    public void setExpectedCashMinor(int expectedCashMinor) { this.expectedCashMinor = expectedCashMinor; }
    public int getActualCashMinor() { return actualCashMinor; }
    public void setActualCashMinor(int actualCashMinor) { this.actualCashMinor = actualCashMinor; }
    public int getCashDiffMinor() { return cashDiffMinor; }
    public void setCashDiffMinor(int cashDiffMinor) { this.cashDiffMinor = cashDiffMinor; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
