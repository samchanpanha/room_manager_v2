package com.rentmanager.properties.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Bound to Prisma {@code Building}. */
@Entity
@Table(name = "Building")
public class Building {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "ownerId")
  private String ownerId;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "address")
  private String address;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Building() {}

  public Building(String propertyId, String name, String address, String tenantId) {
    this.propertyId = propertyId; this.name = name; this.address = address; this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getPropertyId() { return propertyId; }
  public String getName() { return name; }
  public String getAddress() { return address; }
}
