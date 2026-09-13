package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"LedgerEntry\"")
public class LedgerEntry {

    @Id
    private String id;

    @Column(name = "\"transactionId\"", nullable = false)
    private String transactionId;

    @Column(name = "\"accountId\"", nullable = false)
    private String accountId;

    @Column(name = "debit", nullable = false)
    private int debit = 0;

    @Column(name = "credit", nullable = false)
    private int credit = 0;

    @Column(name = "memo")
    private String memo;

    @Column(name = "\"propertyId\"")
    private String propertyId;

    @Column(name = "\"memberId\"")
    private String memberId;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public LedgerEntry() {}

    public LedgerEntry(String id, String transactionId, String accountId, int debit, int credit, String memo) {
        this.id = id;
        this.transactionId = transactionId;
        this.accountId = accountId;
        this.debit = debit;
        this.credit = credit;
        this.memo = memo;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public String getAccountId() { return accountId; }
    public void setAccountId(String accountId) { this.accountId = accountId; }

    public int getDebit() { return debit; }
    public void setDebit(int debit) { this.debit = debit; }

    public int getCredit() { return credit; }
    public void setCredit(int credit) { this.credit = credit; }

    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getMemberId() { return memberId; }
    public void setMemberId(String memberId) { this.memberId = memberId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
