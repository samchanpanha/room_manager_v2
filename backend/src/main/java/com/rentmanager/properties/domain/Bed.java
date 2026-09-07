package com.rentmanager.properties.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/** Bound to Prisma {@code Bed}. */
@Entity
@Table(name = "Bed")
public class Bed {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "roomId", nullable = false)
  private String roomId;

  @Column(name = "label", nullable = false)
  private String label;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Bed() {}

  public Bed(String roomId, String label, String tenantId) {
    this.roomId = roomId; this.label = label; this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getRoomId() { return roomId; }
  public String getLabel() { return label; }
}
