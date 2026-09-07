package com.rentmanager.billing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Late-fee rule (INTENT.md M06) — applied by the daily job after the grace
 * period. FIXED → amountMinor; PERCENT → percentBps of the outstanding amount,
 * capped by capMinor. Bound to the existing Prisma {@code LateFeeRule} table.
 */
@Entity
@Table(name = "LateFeeRule")
public class LateFeeRule {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "type", nullable = false)
  private String type; // FIXED | PERCENT

  @Column(name = "amountMinor")
  private Integer amountMinor;

  @Column(name = "percentBps")
  private Integer percentBps;

  @Column(name = "capMinor")
  private Integer capMinor;

  @Column(name = "graceDays", nullable = false)
  private int graceDays = 3;

  @Column(name = "isActive", nullable = false)
  private boolean isActive = true;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected LateFeeRule() {}

  public String getId() { return id; }
  public String getName() { return name; }
  public String getType() { return type; }
  public Integer getAmountMinor() { return amountMinor; }
  public Integer getPercentBps() { return percentBps; }
  public Integer getCapMinor() { return capMinor; }
  public int getGraceDays() { return graceDays; }
  public boolean isActive() { return isActive; }
}
