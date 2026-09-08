package com.rentmanager.services.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Assignment of a catalog service to a lease (INTENT.md M12). fixed_monthly
 * assignments carry a {@code snapshotId} pointing at the lease's LeaseService
 * billing row; parking/WiFi bind a slot/account uniquely. Bound to
 * {@code ServiceAssignment}.
 */
@Entity
@Table(name = "ServiceAssignment")
public class ServiceAssignment {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "serviceId", nullable = false)
  private String serviceId;

  @Column(name = "leaseId", nullable = false)
  private String leaseId;

  @Column(name = "status", nullable = false)
  private String status = "active"; // active | suspended | ended

  @Column(name = "startDate", nullable = false)
  private Instant startDate;

  @Column(name = "suspendedAt")
  private Instant suspendedAt;

  @Column(name = "endedAt")
  private Instant endedAt;

  @Column(name = "parkingSlotId", unique = true)
  private String parkingSlotId;

  @Column(name = "wifiAccountId", unique = true)
  private String wifiAccountId;

  @Column(name = "snapshotId")
  private String snapshotId;

  @Column(name = "note")
  private String note;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected ServiceAssignment() {}

  public ServiceAssignment(String serviceId, String leaseId, Instant startDate,
      String parkingSlotId, String wifiAccountId, String snapshotId, String note, String tenantId) {
    this.serviceId = serviceId;
    this.leaseId = leaseId;
    this.startDate = startDate;
    this.parkingSlotId = parkingSlotId;
    this.wifiAccountId = wifiAccountId;
    this.snapshotId = snapshotId;
    this.note = note;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getServiceId() { return serviceId; }
  public String getLeaseId() { return leaseId; }
  public String getStatus() { return status; }
  public Instant getStartDate() { return startDate; }
  public Instant getSuspendedAt() { return suspendedAt; }
  public Instant getEndedAt() { return endedAt; }
  public String getParkingSlotId() { return parkingSlotId; }
  public String getWifiAccountId() { return wifiAccountId; }
  public String getSnapshotId() { return snapshotId; }
  public String getNote() { return note; }

  public void suspend(Instant at) { this.status = "suspended"; this.suspendedAt = at; }
  public void end(Instant at) { this.status = "ended"; this.endedAt = at; }
}
