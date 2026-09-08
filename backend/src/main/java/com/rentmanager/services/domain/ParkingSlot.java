package com.rentmanager.services.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Parking slot (INTENT.md M12) — assigned uniquely. Bound to {@code ParkingSlot}. */
@Entity
@Table(name = "ParkingSlot")
public class ParkingSlot {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "monthlyFeeMinor", nullable = false)
  private int monthlyFeeMinor;

  @Column(name = "status", nullable = false)
  private String status = "free"; // free | assigned

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected ParkingSlot() {}

  public ParkingSlot(String code, String propertyId, int monthlyFeeMinor, String tenantId) {
    this.code = code;
    this.propertyId = propertyId;
    this.monthlyFeeMinor = monthlyFeeMinor;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getPropertyId() { return propertyId; }
  public int getMonthlyFeeMinor() { return monthlyFeeMinor; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
