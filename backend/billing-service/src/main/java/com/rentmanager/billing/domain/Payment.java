package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Payment\"")
public class Payment {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "\"propertyId\"")
    private String propertyId;

    @Column(name = "method", nullable = false)
    private String method; // cash | bank_transfer | qr | card | cheque

    @Column(name = "status", nullable = false)
    private String status = "pending"; // pending | confirmed | refunded | failed

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    @Column(name = "\"remainingMinor\"", nullable = false)
    private int remainingMinor = 0;

    @Column(name = "\"receiptCode\"", unique = true)
    private String receiptCode;

    @Column(name = "\"receivedAt\"", nullable = false)
    private Instant receivedAt = Instant.now();

    @Column(name = "\"confirmedAt\"")
    private Instant confirmedAt;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public Payment() {}

    public Payment(String id, String code, String memberProfileId, String propertyId, String method, int amountMinor) {
        this.id = id;
        this.code = code;
        this.memberProfileId = memberProfileId;
        this.propertyId = propertyId;
        this.method = method;
        this.amountMinor = amountMinor;
        this.remainingMinor = amountMinor;
        this.status = "pending";
        this.receivedAt = Instant.now();
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }

    public int getRemainingMinor() { return remainingMinor; }
    public void setRemainingMinor(int remainingMinor) { this.remainingMinor = remainingMinor; }

    public String getReceiptCode() { return receiptCode; }
    public void setReceiptCode(String receiptCode) { this.receiptCode = receiptCode; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
