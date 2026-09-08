package com.rentmanager.services.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** WiFi account (INTENT.md M12) — activate/suspend/release. Bound to {@code WifiAccount}. */
@Entity
@Table(name = "WifiAccount")
public class WifiAccount {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "ssid", nullable = false, unique = true)
  private String ssid;

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "speedLabel")
  private String speedLabel;

  @Column(name = "status", nullable = false)
  private String status = "free"; // free | assigned | suspended

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected WifiAccount() {}

  public WifiAccount(String ssid, String propertyId, String speedLabel, String tenantId) {
    this.ssid = ssid;
    this.propertyId = propertyId;
    this.speedLabel = speedLabel;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getSsid() { return ssid; }
  public String getPropertyId() { return propertyId; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
