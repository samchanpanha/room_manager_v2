package com.rentmanager.commerce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"PosSession\"")
public class PosSession {

    @Id
    private String id;

    @Column(name = "code")
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "status", nullable = false)
    private String status = "open"; // open | closed

    @Column(name = "\"openingFloatMinor\"", nullable = false)
    private int openingFloatMinor = 0;

    @Column(name = "\"expectedCashMinor\"", nullable = false)
    private int expectedCashMinor = 0;

    @Column(name = "\"countedCashMinor\"")
    private Integer countedCashMinor;

    @Column(name = "\"varianceMinor\"")
    private Integer varianceMinor;

    @Column(name = "\"closeNote\"")
    private String closeNote;

    @Column(name = "\"openedById\"", nullable = false)
    private String openedById;

    @Column(name = "\"openedAt\"", nullable = false)
    private Instant openedAt = Instant.now();

    @Column(name = "\"closedById\"")
    private String closedById;

    @Column(name = "\"closedAt\"")
    private Instant closedAt;

    public PosSession() {}

    public PosSession(String id, String code, String propertyId, String openedById, int openingFloatMinor) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.openedById = openedById;
        this.openingFloatMinor = openingFloatMinor;
        this.expectedCashMinor = openingFloatMinor;
        this.status = "open";
        this.openedAt = Instant.now();
    }

    public PosSession(String id, String propertyId, int openingFloatMinor, String openedById) {
        this(id, "POS-" + id.substring(Math.max(0, id.length() - 8)), propertyId, openedById, openingFloatMinor);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code != null ? code : id; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getOpeningFloatMinor() { return openingFloatMinor; }
    public void setOpeningFloatMinor(int openingFloatMinor) { this.openingFloatMinor = openingFloatMinor; }

    public int getOpeningCashMinor() { return openingFloatMinor; }
    public void setOpeningCashMinor(int openingCashMinor) { this.openingFloatMinor = openingCashMinor; }

    public int getExpectedCashMinor() { return expectedCashMinor; }
    public void setExpectedCashMinor(int expectedCashMinor) { this.expectedCashMinor = expectedCashMinor; }

    public Integer getCountedCashMinor() { return countedCashMinor; }
    public void setCountedCashMinor(Integer countedCashMinor) { this.countedCashMinor = countedCashMinor; }

    public int getActualCashMinor() { return countedCashMinor != null ? countedCashMinor : 0; }
    public void setActualCashMinor(int actualCashMinor) { this.countedCashMinor = actualCashMinor; }

    public Integer getVarianceMinor() { return varianceMinor; }
    public void setVarianceMinor(Integer varianceMinor) { this.varianceMinor = varianceMinor; }

    public int getCashDiffMinor() { return varianceMinor != null ? varianceMinor : 0; }
    public void setCashDiffMinor(int cashDiffMinor) { this.varianceMinor = cashDiffMinor; }

    public String getCloseNote() { return closeNote; }
    public void setCloseNote(String closeNote) { this.closeNote = closeNote; }

    public String getNotes() { return closeNote; }
    public void setNotes(String notes) { this.closeNote = notes; }

    public String getOpenedById() { return openedById; }
    public void setOpenedById(String openedById) { this.openedById = openedById; }

    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }

    public String getClosedById() { return closedById; }
    public void setClosedById(String closedById) { this.closedById = closedById; }

    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
}
