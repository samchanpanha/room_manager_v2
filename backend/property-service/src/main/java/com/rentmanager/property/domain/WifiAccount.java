package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"WifiAccount\"")
public class WifiAccount {

    @Id
    private String id;

    @Column(name = "ssid", nullable = false, unique = true)
    private String ssid;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"speedLabel\"")
    private String speedLabel;

    @Column(name = "status", nullable = false)
    private String status = "free";

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public WifiAccount() {}

    public WifiAccount(String id, String ssid, String propertyId, String speedLabel) {
        this.id = id;
        this.ssid = ssid;
        this.propertyId = propertyId;
        this.speedLabel = speedLabel;
        this.status = "free";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSsid() { return ssid; }
    public void setSsid(String ssid) { this.ssid = ssid; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getSpeedLabel() { return speedLabel; }
    public void setSpeedLabel(String speedLabel) { this.speedLabel = speedLabel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
