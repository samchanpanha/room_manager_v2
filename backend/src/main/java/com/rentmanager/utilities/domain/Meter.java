package com.rentmanager.utilities.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Meter (INTENT.md M11) bound to a room. Bound to Prisma {@code Meter}. */
@Entity
@Table(name = "Meter")
public class Meter {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "type", nullable = false)
  private String type; // elec | water | gas

  @Column(name = "unitLabel", nullable = false)
  private String unitLabel = "kWh";

  @Column(name = "roomId", nullable = false)
  private String roomId;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Meter() {}

  public Meter(String code, String type, String unitLabel, String roomId, String tenantId) {
    this.code = code;
    this.type = type;
    this.unitLabel = unitLabel;
    this.roomId = roomId;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getType() { return type; }
  public String getUnitLabel() { return unitLabel; }
  public String getRoomId() { return roomId; }
  public boolean isActive() { return active; }
  public String getTenantId() { return tenantId; }
}
