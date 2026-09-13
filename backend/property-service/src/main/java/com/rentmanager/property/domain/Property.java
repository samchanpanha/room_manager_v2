package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Property\"")
public class Property {

    @Id
    private String id;

    @Column(name = "\"tenantId\"", nullable = false)
    private String tenantId = "DEFAULT";

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "address")
    private String address;

    @Column(name = "status", nullable = false)
    private String status = "active";

    @Column(name = "\"geoLat\"")
    private Double geoLat;

    @Column(name = "\"geoLng\"")
    private Double geoLng;

    @Column(name = "\"geofenceRadiusM\"")
    private Integer geofenceRadiusM;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public Property() {}

    public Property(String id, String tenantId, String code, String name, String address) {
        this.id = id;
        this.tenantId = tenantId;
        this.code = code;
        this.name = name;
        this.address = address;
        this.status = "active";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getGeoLat() { return geoLat; }
    public void setGeoLat(Double geoLat) { this.geoLat = geoLat; }

    public Double getGeoLng() { return geoLng; }
    public void setGeoLng(Double geoLng) { this.geoLng = geoLng; }

    public Integer getGeofenceRadiusM() { return geofenceRadiusM; }
    public void setGeofenceRadiusM(Integer geofenceRadiusM) { this.geofenceRadiusM = geofenceRadiusM; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
