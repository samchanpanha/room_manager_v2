package com.rentmanager.inventory.pos.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Cash-drawer session (INTENT.md M14): open → close with expected-vs-counted
 * variance. {@code expectedCashMinor} = opening float + Σ net cash sales.
 * Bound to the existing Prisma {@code PosSession} table.
 */
@Entity
@Table(name = "PosSession")
public class PosSession {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "status", nullable = false)
  private String status = "open"; // open | closed

  @Column(name = "openingFloatMinor", nullable = false)
  private int openingFloatMinor = 0;

  @Column(name = "expectedCashMinor", nullable = false)
  private int expectedCashMinor = 0;

  @Column(name = "countedCashMinor")
  private Integer countedCashMinor;

  @Column(name = "varianceMinor")
  private Integer varianceMinor;

  @Column(name = "closeNote")
  private String closeNote;

  @Column(name = "openedById", nullable = false)
  private String openedById;

  @Column(name = "openedAt", nullable = false)
  private Instant openedAt = Instant.now();

  @Column(name = "closedById")
  private String closedById;

  @Column(name = "closedAt")
  private Instant closedAt;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected PosSession() {}

  public PosSession(String propertyId, int openingFloatMinor, String openedById, String tenantId) {
    this.propertyId = propertyId;
    this.openingFloatMinor = openingFloatMinor;
    this.expectedCashMinor = openingFloatMinor;
    this.openedById = openedById;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getPropertyId() { return propertyId; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public int getOpeningFloatMinor() { return openingFloatMinor; }
  public int getExpectedCashMinor() { return expectedCashMinor; }
  public void setExpectedCashMinor(int v) { this.expectedCashMinor = v; }
  public Integer getCountedCashMinor() { return countedCashMinor; }
  public void setCountedCashMinor(Integer v) { this.countedCashMinor = v; }
  public Integer getVarianceMinor() { return varianceMinor; }
  public void setVarianceMinor(Integer v) { this.varianceMinor = v; }
  public String getCloseNote() { return closeNote; }
  public void setCloseNote(String v) { this.closeNote = v; }
  public String getOpenedById() { return openedById; }
  public Instant getOpenedAt() { return openedAt; }
  public String getClosedById() { return closedById; }
  public void setClosedById(String v) { this.closedById = v; }
  public Instant getClosedAt() { return closedAt; }
  public void setClosedAt(Instant v) { this.closedAt = v; }
  public String getTenantId() { return tenantId; }
}
