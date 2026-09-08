package com.rentmanager.services.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/** Billable add-on catalog entry (INTENT.md M12). Bound to {@code ServiceCatalog}. */
@Entity
@Table(name = "ServiceCatalog")
public class ServiceCatalog {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "pricingModel", nullable = false)
  private String pricingModel; // fixed_monthly | per_use | metered

  @Column(name = "unitPriceMinor", nullable = false)
  private int unitPriceMinor;

  @Column(name = "unitLabel")
  private String unitLabel;

  @Column(name = "isActive", nullable = false)
  private boolean active = true;

  @Column(name = "imageDocId")
  private String imageDocId;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected ServiceCatalog() {}

  public ServiceCatalog(String code, String name, String pricingModel, int unitPriceMinor,
      String unitLabel, String tenantId) {
    this.code = code;
    this.name = name;
    this.pricingModel = pricingModel;
    this.unitPriceMinor = unitPriceMinor;
    this.unitLabel = unitLabel;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public String getPricingModel() { return pricingModel; }
  public int getUnitPriceMinor() { return unitPriceMinor; }
  public String getUnitLabel() { return unitLabel; }
  public boolean isActive() { return active; }
  public String getImageDocId() { return imageDocId; }
}
