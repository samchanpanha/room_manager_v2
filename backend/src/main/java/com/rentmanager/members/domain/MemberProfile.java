package com.rentmanager.members.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Tenant/resident profile (INTENT.md M02). Bound to Prisma {@code MemberProfile}. */
@Entity
@Table(name = "MemberProfile")
public class MemberProfile {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "partyId", nullable = false, unique = true)
  private String partyId;

  @Column(name = "status", nullable = false)
  private String status = "prospect"; // prospect | verified | active | notice | moved_out

  @Column(name = "blacklisted", nullable = false)
  private boolean blacklisted = false;

  @Column(name = "blacklistReason")
  private String blacklistReason;

  @Column(name = "homePropertyId")
  private String homePropertyId;

  @Column(name = "nationality")
  private String nationality;

  @Column(name = "idNumber")
  private String idNumber;

  @Column(name = "occupation")
  private String occupation;

  @Column(name = "monthlyIncomeMinor")
  private Integer monthlyIncomeMinor;

  @Column(name = "notes")
  private String notes;

  @Column(name = "kycCompletedAt")
  private Instant kycCompletedAt;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "memberProfileId")
  private List<EmergencyContact> emergencyContacts = new ArrayList<>();

  protected MemberProfile() {}

  public MemberProfile(String partyId, String tenantId) {
    this.partyId = partyId;
    this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getPartyId() { return partyId; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public boolean isBlacklisted() { return blacklisted; }
  public void setBlacklisted(boolean b) { this.blacklisted = b; }
  public void setBlacklistReason(String r) { this.blacklistReason = r; }
  public String getHomePropertyId() { return homePropertyId; }
  public void setHomePropertyId(String p) { this.homePropertyId = p; }
  public String getNationality() { return nationality; }
  public void setNationality(String v) { this.nationality = v; }
  public String getIdNumber() { return idNumber; }
  public void setIdNumber(String v) { this.idNumber = v; }
  public String getOccupation() { return occupation; }
  public void setOccupation(String v) { this.occupation = v; }
  public Integer getMonthlyIncomeMinor() { return monthlyIncomeMinor; }
  public void setMonthlyIncomeMinor(Integer v) { this.monthlyIncomeMinor = v; }
  public String getNotes() { return notes; }
  public void setNotes(String v) { this.notes = v; }
  public String getTenantId() { return tenantId; }
  public List<EmergencyContact> getEmergencyContacts() { return emergencyContacts; }
}
