package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Bound to the Prisma {@code User} table. Read-only for slice 1; the roles and
 * property assignments are loaded explicitly via the session entity graph, so
 * both collections stay LAZY.
 */
@Entity
@Table(name = "User")
public class User {

  @Id
  @Column(name = "id")
  private String id;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  @Column(name = "email", nullable = false, unique = true)
  private String email;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "passwordHash", nullable = false)
  private String passwordHash;

  /** active | disabled */
  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "totpEnabled", nullable = false)
  private boolean totpEnabled;

  @Column(name = "mustChangePassword", nullable = false)
  private boolean mustChangePassword;

  @Column(name = "partyId")
  private String partyId;

  @Column(name = "createdAt", nullable = false)
  private Instant createdAt;

  /** Managed by the app on every write (Prisma {@code @updatedAt}); no DB default. */
  @Column(name = "updatedAt", nullable = false)
  private Instant updatedAt;

  /** §M27 TOTP shared secret, sealed with SETTINGS_ENC_KEY by the Next app. */
  @Column(name = "totpSecret")
  private String totpSecret;

  @OneToMany(fetch = FetchType.LAZY)
  @JoinColumn(name = "userId")
  private Set<UserRole> roles = new HashSet<>();

  @OneToMany(fetch = FetchType.LAZY)
  @JoinColumn(name = "userId")
  private Set<UserPropertyAssignment> assignments = new HashSet<>();

  protected User() {}

  public String getId() { return id; }
  public String getTenantId() { return tenantId; }
  public String getEmail() { return email; }
  public String getName() { return name; }
  public String getPasswordHash() { return passwordHash; }
  public String getStatus() { return status; }
  public boolean isTotpEnabled() { return totpEnabled; }
  public boolean isMustChangePassword() { return mustChangePassword; }
  public String getPartyId() { return partyId; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public String getTotpSecret() { return totpSecret; }
  public Set<UserRole> getRoles() { return roles; }
  public Set<UserPropertyAssignment> getAssignments() { return assignments; }
}