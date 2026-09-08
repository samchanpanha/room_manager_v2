package com.rentmanager.iam.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** User ↔ Role assignment. Bound to Prisma {@code UserRole}. */
@Entity
@Table(name = "UserRole")
@IdClass(UserRoleId.class)
public class UserRole {

  @Id
  @Column(name = "userId")
  private String userId;

  @Id
  @Column(name = "roleId")
  private String roleId;

  @Column(name = "assignedAt", nullable = false)
  private Instant assignedAt = Instant.now();

  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "roleId", insertable = false, updatable = false)
  private Role role;

  protected UserRole() {}

  public String getUserId() { return userId; }
  public String getRoleId() { return roleId; }
  public Role getRole() { return role; }
}
