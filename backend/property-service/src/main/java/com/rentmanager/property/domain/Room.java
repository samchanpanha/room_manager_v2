package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Room\"")
public class Room {

    @Id
    private String id;

    @Column(name = "\"floorId\"", nullable = false)
    private String floorId;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "type", nullable = false)
    private String type = "STANDARD";

    @Column(name = "status", nullable = false)
    private String status = "vacant";

    @Column(name = "\"basePriceMinor\"", nullable = false)
    private int basePriceMinor = 0;

    @Column(name = "capacity", nullable = false)
    private int capacity = 1;

    @Column(name = "notes")
    private String notes;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Room() {}

    public Room(String id, String floorId, String number, String type, int basePriceMinor, int capacity) {
        this.id = id;
        this.floorId = floorId;
        this.number = number;
        this.type = type;
        this.basePriceMinor = basePriceMinor;
        this.capacity = capacity;
        this.status = "vacant";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFloorId() { return floorId; }
    public void setFloorId(String floorId) { this.floorId = floorId; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getBasePriceMinor() { return basePriceMinor; }
    public void setBasePriceMinor(int basePriceMinor) { this.basePriceMinor = basePriceMinor; }

    public int getCapacity() { return capacity; }
    public void setCapacity(int capacity) { this.capacity = capacity; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
