package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"InvoiceItem\"")
public class InvoiceItem {

    @Id
    private String id;

    @Column(name = "\"invoiceId\"", nullable = false)
    private String invoiceId;

    @Column(name = "kind", nullable = false)
    private String kind; // rent | service | utility | one_time | late_fee | credit

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "qty", nullable = false)
    private int qty = 1;

    @Column(name = "\"unitMinor\"", nullable = false)
    private int unitMinor;

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    public InvoiceItem() {}

    public InvoiceItem(String id, String invoiceId, String kind, String name, int qty, int unitMinor, int amountMinor) {
        this.id = id;
        this.invoiceId = invoiceId;
        this.kind = kind;
        this.name = name;
        this.qty = qty;
        this.unitMinor = unitMinor;
        this.amountMinor = amountMinor;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getInvoiceId() { return invoiceId; }
    public void setInvoiceId(String invoiceId) { this.invoiceId = invoiceId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getQty() { return qty; }
    public void setQty(int qty) { this.qty = qty; }

    public int getUnitMinor() { return unitMinor; }
    public void setUnitMinor(int unitMinor) { this.unitMinor = unitMinor; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }
}
