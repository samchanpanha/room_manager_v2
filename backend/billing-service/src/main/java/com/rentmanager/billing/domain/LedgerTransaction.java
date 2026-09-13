package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"LedgerTransaction\"")
public class LedgerTransaction {

    @Id
    private String id;

    @Column(name = "\"postedAt\"", nullable = false)
    private Instant postedAt = Instant.now();

    @Column(name = "memo", nullable = false)
    private String memo;

    @Column(name = "\"refType\"", nullable = false)
    private String refType; // invoice | payment | deposit | credit_note | expense | etc.

    @Column(name = "\"refId\"")
    private String refId;

    @Column(name = "\"propertyId\"")
    private String propertyId;

    @Column(name = "\"memberId\"")
    private String memberId;

    @Column(name = "\"totalDebit\"", nullable = false)
    private int totalDebit;

    @Column(name = "\"totalCredit\"", nullable = false)
    private int totalCredit;

    @Column(name = "\"reversalOfId\"")
    private String reversalOfId;

    @Column(name = "\"createdById\"")
    private String createdById;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public LedgerTransaction() {}

    public LedgerTransaction(String id, String memo, String refType, String refId,
                             String propertyId, String memberId, int totalDebit, int totalCredit) {
        this.id = id;
        this.memo = memo;
        this.refType = refType;
        this.refId = refId;
        this.propertyId = propertyId;
        this.memberId = memberId;
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
        this.postedAt = Instant.now();
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Instant getPostedAt() { return postedAt; }
    public void setPostedAt(Instant postedAt) { this.postedAt = postedAt; }

    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }

    public String getRefType() { return refType; }
    public void setRefType(String refType) { this.refType = refType; }

    public String getRefId() { return refId; }
    public void setRefId(String refId) { this.refId = refId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getMemberId() { return memberId; }
    public void setMemberId(String memberId) { this.memberId = memberId; }

    public int getTotalDebit() { return totalDebit; }
    public void setTotalDebit(int totalDebit) { this.totalDebit = totalDebit; }

    public int getTotalCredit() { return totalCredit; }
    public void setTotalCredit(int totalCredit) { this.totalCredit = totalCredit; }

    public String getReversalOfId() { return reversalOfId; }
    public void setReversalOfId(String reversalOfId) { this.reversalOfId = reversalOfId; }

    public String getCreatedById() { return createdById; }
    public void setCreatedById(String createdById) { this.createdById = createdById; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
