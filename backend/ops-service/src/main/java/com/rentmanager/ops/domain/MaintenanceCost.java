package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"MaintenanceCost\"")
public class MaintenanceCost {

    @Id
    private String id;

    @Column(name = "\"ticketId\"", nullable = false)
    private String ticketId;

    @Column(name = "kind", nullable = false)
    private String kind; // labor | material

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "\"amountMinor\"", nullable = false)
    private int amountMinor;

    @Column(name = "\"chargeTo\"", nullable = false)
    private String chargeTo = "expense"; // expense | owner

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public MaintenanceCost() {}

    public MaintenanceCost(String id, String ticketId, String kind, String label, int amountMinor) {
        this.id = id;
        this.ticketId = ticketId;
        this.kind = kind;
        this.label = label;
        this.amountMinor = amountMinor;
        this.chargeTo = "expense";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTicketId() { return ticketId; }
    public void setTicketId(String ticketId) { this.ticketId = ticketId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public int getAmountMinor() { return amountMinor; }
    public void setAmountMinor(int amountMinor) { this.amountMinor = amountMinor; }

    public String getChargeTo() { return chargeTo; }
    public void setChargeTo(String chargeTo) { this.chargeTo = chargeTo; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
