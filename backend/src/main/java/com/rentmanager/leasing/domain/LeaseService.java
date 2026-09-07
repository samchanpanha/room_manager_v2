package com.rentmanager.leasing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Snapshotted add-on service on a lease (M05/M12). Bound to {@code LeaseService}. */
@Entity
@Table(name = "LeaseService")
public class LeaseService {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "leaseId", nullable = false)
  private String leaseId;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "amountMinor", nullable = false)
  private int amountMinor;

  @Column(name = "pricingModel", nullable = false)
  private String pricingModel = "fixed_monthly";

  @Column(name = "activeFrom")
  private Instant activeFrom;

  @Column(name = "activeThrough")
  private Instant activeThrough;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected LeaseService() {}

  public LeaseService(String name, int amountMinor, String pricingModel, String tenantId) {
    this.name = name;
    this.amountMinor = amountMinor;
    this.pricingModel = pricingModel;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public int getAmountMinor() { return amountMinor; }
  public String getPricingModel() { return pricingModel; }
}
