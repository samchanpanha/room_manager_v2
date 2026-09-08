package com.rentmanager.properties.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Bound to Prisma {@code Room}. Status machine enforced in the service layer. */
@Entity
@Table(name = "Room")
public class Room {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "floorId", nullable = false)
  private String floorId;

  @Column(name = "number", nullable = false)
  private String number;

  @Column(name = "type", nullable = false)
  private String type = "STANDARD";

  @Column(name = "status", nullable = false)
  private String status = "vacant"; // vacant|reserved|occupied|cleaning|maintenance

  @Column(name = "basePriceMinor", nullable = false)
  private int basePriceMinor = 0;

  @Column(name = "capacity", nullable = false)
  private int capacity = 1;

  @Column(name = "notes")
  private String notes;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Room() {}

  public Room(String floorId, String number, String type, int basePriceMinor,
      int capacity, String tenantId) {
    this.floorId = floorId; this.number = number; this.type = type;
    this.basePriceMinor = basePriceMinor; this.capacity = capacity; this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getFloorId() { return floorId; }
  public String getNumber() { return number; }
  public String getType() { return type; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public int getBasePriceMinor() { return basePriceMinor; }
  public int getCapacity() { return capacity; }
  public String getNotes() { return notes; }
}
