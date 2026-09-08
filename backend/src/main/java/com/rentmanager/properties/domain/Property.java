package com.rentmanager.properties.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Bound to Prisma {@code Property} (INTENT.md M04). */
@Entity
@Table(name = "Property")
public class Property {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "address")
  private String address;

  @Column(name = "status", nullable = false)
  private String status = "active";

  @Column(name = "geoLat") private Double geoLat;
  @Column(name = "geoLng") private Double geoLng;
  @Column(name = "geofenceRadiusM") private Integer geofenceRadiusM;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Property() {}

  public Property(String code, String name, String address, String tenantId) {
    this.code = code; this.name = name; this.address = address; this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getAddress() { return address; }
  public void setAddress(String v) { this.address = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
}
