package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Tax rule (INTENT.md M06). The active default supplies the invoice tax rate the
 * rent engine applies. Bound to the existing Prisma {@code TaxRule} table.
 */
@Entity
@Table(name = "TaxRule")
public class TaxRule {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "percentBps", nullable = false)
  private int percentBps = 0; // 10000 = 100%

  @Column(name = "isDefault", nullable = false)
  private boolean isDefault = false;

  @Column(name = "isActive", nullable = false)
  private boolean isActive = true;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected TaxRule() {}

  public String getId() { return id; }
  public String getName() { return name; }
  public int getPercentBps() { return percentBps; }
  public boolean isDefault() { return isDefault; }
  public boolean isActive() { return isActive; }
}
