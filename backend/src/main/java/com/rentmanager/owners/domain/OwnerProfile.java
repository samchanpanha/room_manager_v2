package com.rentmanager.owners.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Landlord profile (INTENT.md M03). Bound to Prisma {@code OwnerProfile}. */
@Entity
@Table(name = "OwnerProfile")
public class OwnerProfile {

  @Id @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "partyId", nullable = false, unique = true)
  private String partyId;

  @Column(name = "status", nullable = false)
  private String status = "active"; // active | archived

  @Column(name = "companyName")
  private String companyName;

  @Column(name = "notes")
  private String notes;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "ownerProfileId")
  private List<OwnerPayoutMethod> payoutMethods = new ArrayList<>();

  protected OwnerProfile() {}

  public OwnerProfile(String partyId, String companyName, String notes, String tenantId) {
    this.partyId = partyId;
    this.companyName = companyName;
    this.notes = notes;
    this.tenantId = tenantId;
  }

  @PreUpdate void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getPartyId() { return partyId; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public String getCompanyName() { return companyName; }
  public String getNotes() { return notes; }
  public Instant getCreatedAt() { return createdAt; }
  public String getTenantId() { return tenantId; }
  public List<OwnerPayoutMethod> getPayoutMethods() { return payoutMethods; }
}
