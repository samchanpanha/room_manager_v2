package com.rentmanager.commerce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"PosSale\"")
public class PosSale {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"sessionId\"", nullable = false)
    private String sessionId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "method", nullable = false)
    private String method; // cash | qr | card | room_charge

    @Column(name = "\"totalMinor\"", nullable = false)
    private int totalMinor;

    @Column(name = "\"discountMinor\"", nullable = false)
    private int discountMinor = 0;

    @Column(name = "\"memberProfileId\"")
    private String memberProfileId;

    @Column(name = "\"invoiceId\"", unique = true)
    private String invoiceId;

    @Column(name = "\"soldById\"", nullable = false)
    private String soldById;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public PosSale() {}

    public PosSale(String id, String code, String sessionId, String propertyId, String method, int totalMinor, String soldById) {
        this.id = id;
        this.code = code;
        this.sessionId = sessionId;
        this.propertyId = propertyId;
        this.method = method;
        this.totalMinor = totalMinor;
        this.soldById = soldById;
        this.createdAt = Instant.now();
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
}
