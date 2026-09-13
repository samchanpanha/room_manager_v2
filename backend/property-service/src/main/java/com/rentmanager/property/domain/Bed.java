package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"Bed\"")
public class Bed {

    @Id
    private String id;

    @Column(name = "\"roomId\"", nullable = false)
    private String roomId;

    @Column(name = "label", nullable = false)
    private String label;

    public Bed() {}

    public Bed(String id, String roomId, String label) {
        this.id = id;
        this.roomId = roomId;
        this.label = label;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
