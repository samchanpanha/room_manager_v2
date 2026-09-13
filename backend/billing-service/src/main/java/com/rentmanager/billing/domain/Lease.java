package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Lease\"")
public class Lease {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "\"roomId\"", nullable = false)
    private String roomId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "status", nullable = false)
    private String status = "draft";

    @Column(name = "\"startDate\"", nullable = false)
    private Instant startDate;

    @Column(name = "\"endDate\"")
    private Instant endDate;

    @Column(name = "\"rentAmountMinor\"", nullable = false)
    private int rentAmountMinor;

    @Column(name = "\"billingCycleDay\"", nullable = false)
    private int billingCycleDay = 1;

    @Column(name = "\"depositTotalMinor\"", nullable = false)
    private int depositTotalMinor = 0;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Lease() {}

    public Lease(String id, String code, String memberProfileId, String roomId, String propertyId,
                 Instant startDate, int rentAmountMinor, int depositTotalMinor) {
        this.id = id;
        this.code = code;
        this.memberProfileId = memberProfileId;
        this.roomId = roomId;
        this.propertyId = propertyId;
        this.startDate = startDate;
        this.rentAmountMinor = rentAmountMinor;
        this.depositTotalMinor = depositTotalMinor;
        this.status = "draft";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }

    public Instant getEndDate() { return endDate; }
    public void setEndDate(Instant endDate) { this.endDate = endDate; }

    public int getRentAmountMinor() { return rentAmountMinor; }
    public void setRentAmountMinor(int rentAmountMinor) { this.rentAmountMinor = rentAmountMinor; }

    public int getBillingCycleDay() { return billingCycleDay; }
    public void setBillingCycleDay(int billingCycleDay) { this.billingCycleDay = billingCycleDay; }

    public int getDepositTotalMinor() { return depositTotalMinor; }
    public void setDepositTotalMinor(int depositTotalMinor) { this.depositTotalMinor = depositTotalMinor; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
