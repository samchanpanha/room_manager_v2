package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"PaymentAllocation\"")
public class PaymentAllocation {

    @Id
    private String id;

    @Column(name = "\"paymentId\"", nullable = false)
    private String paymentId;

    @Column(name = "\"invoiceId\"", nullable = false)
    private String invoiceId;

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public PaymentAllocation() {}

    public PaymentAllocation(String id, String paymentId, String invoiceId, int amountMinor) {
        this.id = id;
        this.paymentId = paymentId;
        this.invoiceId = invoiceId;
        this.amountMinor = amountMinor;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public String getInvoiceId() { return invoiceId; }
    public void setInvoiceId(String invoiceId) { this.invoiceId = invoiceId; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
