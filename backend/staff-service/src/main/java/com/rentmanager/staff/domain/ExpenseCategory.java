package com.rentmanager.staff.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"ExpenseCategory\"")
public class ExpenseCategory {

    @Id
    private String id;

    @Column(name = "\"propertyId\"")
    private String propertyId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "\"chargeTo\"", nullable = false)
    private String chargeTo = "company"; // company | passthrough | owner_maintenance

    @Column(name = "\"isActive\"", nullable = false)
    private boolean isActive = true;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public ExpenseCategory() {}

    public ExpenseCategory(String id, String propertyId, String name, String chargeTo) {
        this.id = id;
        this.propertyId = propertyId;
        this.name = name;
        this.chargeTo = chargeTo;
        this.isActive = true;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getChargeTo() { return chargeTo; }
    public void setChargeTo(String chargeTo) { this.chargeTo = chargeTo; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
