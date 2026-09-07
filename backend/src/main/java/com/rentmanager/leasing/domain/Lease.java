package com.rentmanager.leasing.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Member occupancy lease (INTENT.md M05). Bound to Prisma {@code Lease}. */
@Entity
@Table(name = "Lease")
public class Lease {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "code", nullable = false, unique = true)
  private String code;

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  @Column(name = "roomId", nullable = false)
  private String roomId;

  @Column(name = "bedId")
  private String bedId; // null = whole-room lease

  @Column(name = "propertyId", nullable = false)
  private String propertyId;

  @Column(name = "status", nullable = false)
  private String status = "draft"; // draft|active|notice|terminated|completed

  @Column(name = "startDate", nullable = false)
  private Instant startDate;

  @Column(name = "endDate")
  private Instant endDate;

  @Column(name = "rentAmountMinor", nullable = false)
  private int rentAmountMinor;

  @Column(name = "billingCycleDay", nullable = false)
  private int billingCycleDay = 1;

  @Column(name = "prorationBasis", nullable = false)
  private String prorationBasis = "calendar";

  @Column(name = "depositTotalMinor", nullable = false)
  private int depositTotalMinor = 0;

  @Column(name = "depositInstallments", nullable = false)
  private int depositInstallments = 1;

  @Column(name = "noticeDays", nullable = false)
  private int noticeDays = 30;

  @Column(name = "autoRenew", nullable = false)
  private boolean autoRenew = false;

  @Column(name = "escalationPercent")
  private Integer escalationPercent;

  @Column(name = "nextBillingDate")
  private Instant nextBillingDate;

  @Column(name = "moveOutInspectionId", unique = true)
  private String moveOutInspectionId;

  @Column(name = "terminationReason")
  private String terminationReason;

  @Column(name = "terminatedAt")
  private Instant terminatedAt;

  @Column(name = "createdById")
  private String createdById;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "leaseId")
  private List<LeaseService> services = new ArrayList<>();

  protected Lease() {}

  public Lease(String code, String memberProfileId, String roomId, String bedId,
      String propertyId, Instant startDate, int rentAmountMinor, String tenantId) {
    this.code = code;
    this.memberProfileId = memberProfileId;
    this.roomId = roomId;
    this.bedId = bedId;
    this.propertyId = propertyId;
    this.startDate = startDate;
    this.rentAmountMinor = rentAmountMinor;
    this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getCode() { return code; }
  public String getMemberProfileId() { return memberProfileId; }
  public String getRoomId() { return roomId; }
  public String getBedId() { return bedId; }
  public String getPropertyId() { return propertyId; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public Instant getStartDate() { return startDate; }
  public Instant getEndDate() { return endDate; }
  public void setEndDate(Instant d) { this.endDate = d; }
  public int getRentAmountMinor() { return rentAmountMinor; }
  public int getBillingCycleDay() { return billingCycleDay; }
  public void setBillingCycleDay(int d) { this.billingCycleDay = d; }
  public String getProrationBasis() { return prorationBasis; }
  public void setProrationBasis(String b) { this.prorationBasis = b; }
  public int getDepositTotalMinor() { return depositTotalMinor; }
  public void setDepositTotalMinor(int v) { this.depositTotalMinor = v; }
  public int getDepositInstallments() { return depositInstallments; }
  public void setDepositInstallments(int v) { this.depositInstallments = v; }
  public int getNoticeDays() { return noticeDays; }
  public void setNoticeDays(int v) { this.noticeDays = v; }
  public boolean isAutoRenew() { return autoRenew; }
  public void setAutoRenew(boolean v) { this.autoRenew = v; }
  public Integer getEscalationPercent() { return escalationPercent; }
  public void setEscalationPercent(Integer v) { this.escalationPercent = v; }
  public Instant getNextBillingDate() { return nextBillingDate; }
  public void setNextBillingDate(Instant d) { this.nextBillingDate = d; }
  public String getMoveOutInspectionId() { return moveOutInspectionId; }
  public String getTerminationReason() { return terminationReason; }
  public void setTerminationReason(String r) { this.terminationReason = r; }
  public Instant getTerminatedAt() { return terminatedAt; }
  public void setTerminatedAt(Instant t) { this.terminatedAt = t; }
  public String getCreatedById() { return createdById; }
  public void setCreatedById(String v) { this.createdById = v; }
  public String getTenantId() { return tenantId; }
  public List<LeaseService> getServices() { return services; }
}
