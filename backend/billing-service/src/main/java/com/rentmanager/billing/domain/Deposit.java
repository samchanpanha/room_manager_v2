package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Deposit\"")
public class Deposit {

    @Id
    private String id;

    @Column(name = "\"leaseId\"", nullable = false, unique = true)
    private String leaseId;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "\"propertyId\"")
    private String propertyId;

    @Column(name = "\"requiredMinor\"", nullable = false)
    private int requiredMinor;

    @Column(name = "status", nullable = false)
    private String status = "pending"; // pending | billed | held | settled

    @Column(name = "\"invoiceId\"", unique = true)
    private String invoiceId;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Deposit() {}

    public Deposit(String id, String leaseId, String memberProfileId, String propertyId, int requiredMinor) {
        this.id = id;
        this.leaseId = leaseId;
        this.memberProfileId = memberProfileId;
        this.propertyId = propertyId;
        this.requiredMinor = requiredMinor;
        this.status = "pending";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public int getRequiredMinor() { return requiredMinor; }
    public void setRequiredMinor(int requiredMinor) { this.requiredMinor = requiredMinor; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getInvoiceId() { return invoiceId; }
    public void setInvoiceId(String invoiceId) { this.invoiceId = invoiceId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
