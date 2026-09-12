package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Lease bound to the Prisma {@code Lease} table. Read-only for slice 1; only
 * the columns used by the members list are mapped ({@code code}, {@code status}
 * and the {@code room} join).
 */
@Entity
@Table(name = "Lease")
public class Lease {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  /** draft | active | notice | terminated | completed */
  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "roomId", insertable = false, updatable = false)
  private Room room;

  protected Lease() {}

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getMemberProfileId() { return memberProfileId; }
  public String getStatus() { return status; }
  public Room getRoom() { return room; }
}