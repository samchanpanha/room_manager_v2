package com.rentmanager.staff.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Expense\"")
public class Expense {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"categoryId\"", nullable = false)
    private String categoryId;

    @Column(name = "\"vendorName\"", nullable = false)
    private String vendorName;

    @Column(name = "description")
    private String description;

    @Column(name = "\"expenseDate\"", nullable = false)
    private Instant expenseDate;

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    @Column(name = "\"paidVia\"", nullable = false)
    private String paidVia; // cash | bank_transfer

    @Column(name = "status", nullable = false)
    private String status = "pending"; // pending | approved | rejected | voided

    @Column(name = "\"autoApproved\"", nullable = false)
    private boolean autoApproved = false;

    @Column(name = "\"submittedById\"", nullable = false)
    private String submittedById;

    @Column(name = "\"approvedById\"")
    private String approvedById;

    @Column(name = "\"approvedAt\"")
    private Instant approvedAt;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Expense() {}

    public Expense(String id, String code, String propertyId, String categoryId, String vendorName,
                   Instant expenseDate, int amountMinor, String paidVia, String submittedById) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.categoryId = categoryId;
        this.vendorName = vendorName;
        this.expenseDate = expenseDate;
        this.amountMinor = amountMinor;
        this.paidVia = paidVia;
        this.submittedById = submittedById;
        this.status = "pending";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String categoryId) { this.categoryId = categoryId; }

    public String getVendorName() { return vendorName; }
    public void setVendorName(String vendorName) { this.vendorName = vendorName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getExpenseDate() { return expenseDate; }
    public void setExpenseDate(Instant expenseDate) { this.expenseDate = expenseDate; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }

    public String getPaidVia() { return paidVia; }
    public void setPaidVia(String paidVia) { this.paidVia = paidVia; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isAutoApproved() { return autoApproved; }
    public void setAutoApproved(boolean autoApproved) { this.autoApproved = autoApproved; }

    public String getSubmittedById() { return submittedById; }
    public void setSubmittedById(String submittedById) { this.submittedById = submittedById; }

    public String getApprovedById() { return approvedById; }
    public void setApprovedById(String approvedById) { this.approvedById = approvedById; }

    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
