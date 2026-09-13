package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"Floor\"")
public class Floor {

    @Id
    private String id;

    @Column(name = "\"buildingId\"", nullable = false)
    private String buildingId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "level", nullable = false)
    private int level;

    public Floor() {}

    public Floor(String id, String buildingId, String name, int level) {
        this.id = id;
        this.buildingId = buildingId;
        this.name = name;
        this.level = level;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getBuildingId() { return buildingId; }
    public void setBuildingId(String buildingId) { this.buildingId = buildingId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getLevel() { return level; }
    public void setLevel(int level) { this.level = level; }
}
