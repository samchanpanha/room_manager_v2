package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"LeaseService\"")
public class LeaseService {

    @Id
    private String id;

    @Column(name = "\"leaseId\"", nullable = false)
    private String leaseId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    @Column(name = "\"pricingModel\"", nullable = false)
    private String pricingModel = "fixed_monthly";

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public LeaseService() {}

    public LeaseService(String id, String leaseId, String name, int amountMinor) {
        this.id = id;
        this.leaseId = leaseId;
        this.name = name;
        this.amountMinor = amountMinor;
        this.pricingModel = "fixed_monthly";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }

    public String getPricingModel() { return pricingModel; }
    public void setPricingModel(String pricingModel) { this.pricingModel = pricingModel; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
