package com.rentmanager.properties.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/** Bound to Prisma {@code Floor}. */
@Entity
@Table(name = "Floor")
public class Floor {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "buildingId", nullable = false)
  private String buildingId;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "level", nullable = false)
  private int level;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Floor() {}

  public Floor(String buildingId, String name, int level, String tenantId) {
    this.buildingId = buildingId; this.name = name; this.level = level; this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getBuildingId() { return buildingId; }
  public String getName() { return name; }
  public int getLevel() { return level; }
}
