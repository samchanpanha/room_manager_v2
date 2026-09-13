package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Invoice\"")
public class Invoice {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"leaseId\"")
    private String leaseId;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "status", nullable = false)
    private String status = "draft";

    @Column(name = "\"periodStart\"", nullable = false)
    private Instant periodStart;

    @Column(name = "\"periodEnd\"", nullable = false)
    private Instant periodEnd;

    @Column(name = "\"issuedAt\"")
    private Instant issuedAt;

    @Column(name = "\"dueDate\"")
    private Instant dueDate;

    @Column(name = "\"subtotalMinor\"", nullable = false)
    private int subtotalMinor = 0;

    @Column(name = "\"discountMinor\"", nullable = false)
    private int discountMinor = 0;

    @Column(name = "\"taxMinor\"", nullable = false)
    private int taxMinor = 0;

    @Column(name = "\"totalMinor\"", nullable = false)
    private int totalMinor = 0;

    @Column(name = "\"amountPaidMinor\"", nullable = false)
    private int amountPaidMinor = 0;

    @Column(name = "\"amountCreditedMinor\"", nullable = false)
    private int amountCreditedMinor = 0;

    @Column(name = "\"amountDueMinor\"", nullable = false)
    private int amountDueMinor = 0;

    @Column(name = "\"isDeposit\"", nullable = false)
    private boolean isDeposit = false;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Invoice() {}

    public Invoice(String id, String code, String propertyId, String leaseId, String memberProfileId,
                   Instant periodStart, Instant periodEnd, int totalMinor) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.leaseId = leaseId;
        this.memberProfileId = memberProfileId;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.subtotalMinor = totalMinor;
        this.totalMinor = totalMinor;
        this.amountDueMinor = totalMinor;
        this.status = "draft";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getPeriodStart() { return periodStart; }
    public void setPeriodStart(Instant periodStart) { this.periodStart = periodStart; }

    public Instant getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(Instant periodEnd) { this.periodEnd = periodEnd; }

    public Instant getIssuedAt() { return issuedAt; }
    public void setIssuedAt(Instant issuedAt) { this.issuedAt = issuedAt; }

    public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }

    public int getSubtotalMinor() { return subtotalMinor; }
    public void setSubtotalMinor(int subtotalMinor) { this.subtotalMinor = subtotalMinor; }

    public int getDiscountMinor() { return discountMinor; }
    public void setDiscountMinor(int discountMinor) { this.discountMinor = discountMinor; }

    public int getTaxMinor() { return taxMinor; }
    public void setTaxMinor(int taxMinor) { this.taxMinor = taxMinor; }

    public int getTotalMinor() { return totalMinor; }
    public void setTotalMinor(int totalMinor) { this.totalMinor = totalMinor; }

    public int getAmountPaidMinor() { return amountPaidMinor; }
    public void setAmountPaidMinor(int amountPaidMinor) { this.amountPaidMinor = amountPaidMinor; }

    public int getAmountCreditedMinor() { return amountCreditedMinor; }
    public void setAmountCreditedMinor(int amountCreditedMinor) { this.amountCreditedMinor = amountCreditedMinor; }

    public int getAmountDueMinor() { return amountDueMinor; }
    public void setAmountDueMinor(int amountDueMinor) { this.amountDueMinor = amountDueMinor; }

    public boolean isDeposit() { return isDeposit; }
    public void setDeposit(boolean deposit) { isDeposit = deposit; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
