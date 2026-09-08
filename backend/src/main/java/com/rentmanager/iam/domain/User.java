package com.rentmanager.iam.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** Bound to the existing Prisma {@code User} table. */
@Entity
@Table(name = "User")
public class User {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "email", nullable = false, unique = true)
  private String email;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "passwordHash", nullable = false)
  private String passwordHash;

  @Column(name = "status", nullable = false)
  private String status = "active";

  @Column(name = "totpEnabled", nullable = false)
  private boolean totpEnabled = false;

  @Column(name = "mustChangePassword", nullable = false)
  private boolean mustChangePassword = false;

  @Column(name = "partyId")
  private String partyId;

  @Column(name = "totpSecret")
  private String totpSecret;

  @Column(name = "kioskPinHash")
  private String kioskPinHash;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @OneToMany(fetch = FetchType.EAGER)
  @JoinColumn(name = "userId")
  private Set<UserRole> roles = new HashSet<>();

  @OneToMany(fetch = FetchType.EAGER)
  @JoinColumn(name = "userId")
  private Set<UserPropertyAssignment> assignments = new HashSet<>();

  protected User() {}

  public User(String email, String name, String passwordHash, String tenantId) {
    this.email = email;
    this.name = name;
    this.passwordHash = passwordHash;
    this.tenantId = tenantId;
  }

  @PreUpdate
  void touch() { this.updatedAt = Instant.now(); }

  public String getId() { return id; }
  public String getEmail() { return email; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String h) { this.passwordHash = h; }
  public String getStatus() { return status; }
  public void setStatus(String s) { this.status = s; }
  public boolean isTotpEnabled() { return totpEnabled; }
  public boolean isMustChangePassword() { return mustChangePassword; }
  public void setMustChangePassword(boolean v) { this.mustChangePassword = v; }
  public String getPartyId() { return partyId; }
  public void linkParty(String partyId) { this.partyId = partyId; }
  public String getTotpSecret() { return totpSecret; }
  public String getTenantId() { return tenantId; }
  public Set<UserRole> getRoles() { return roles; }
  public Set<UserPropertyAssignment> getAssignments() { return assignments; }
}
