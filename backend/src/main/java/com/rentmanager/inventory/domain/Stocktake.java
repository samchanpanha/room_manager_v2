package com.rentmanager.inventory.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Counted inventory (INTENT.md M15 "stocktake variance posts adjustment").
 * Creating a stocktake writes {@code adjustment} movements for every variance
 * ≠ 0 and snapshots the total valuation delta. Bound to Prisma {@code Stocktake}.
 */
@Entity
@Table(name = "Stocktake")
public class Stocktake {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code; // STK-YYYY-NNNN

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "status", nullable = false)
  private String status = "completed"; // completed | cancelled

  @Column(name = "valueDeltaMilli", nullable = false)
  private int valueDeltaMilli = 0;

  @Column(name = "note")
  private String note;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected Stocktake() {}

  public Stocktake(String code, String propertyId, String note, String createdById, String tenantId) {
    this.code = code;
    this.propertyId = propertyId;
    this.note = note;
    this.createdById = createdById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getPropertyId() { return propertyId; }
  public String getStatus() { return status; }
  public int getValueDeltaMilli() { return valueDeltaMilli; }
  public void setValueDeltaMilli(int v) { this.valueDeltaMilli = v; }
  public String getNote() { return note; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
}
