package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"ParkingSlot\"")
public class ParkingSlot {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"monthlyFeeMinor\"", nullable = false)
    private int monthlyFeeMinor;

    @Column(name = "status", nullable = false)
    private String status = "free";

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public ParkingSlot() {}

    public ParkingSlot(String id, String code, String propertyId, int monthlyFeeMinor) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.monthlyFeeMinor = monthlyFeeMinor;
        this.status = "free";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public int getMonthlyFeeMinor() { return monthlyFeeMinor; }
    public void setMonthlyFeeMinor(int monthlyFeeMinor) { this.monthlyFeeMinor = monthlyFeeMinor; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
