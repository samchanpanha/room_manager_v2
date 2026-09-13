package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * User ↔ Role assignment. Bound to the Prisma {@code UserRole} table.
 * Read-only for slice 1.
 */
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
  private Instant assignedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "roleId", insertable = false, updatable = false)
  private Role role;

  protected UserRole() {}

  public String getUserId() { return userId; }
  public String getRoleId() { return roleId; }
  public Role getRole() { return role; }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserRole that)) return false;
    return userId.equals(that.userId) && roleId.equals(that.roleId);
  }

  @Override
  public int hashCode() {
    int result = userId.hashCode();
    result = 31 * result + roleId.hashCode();
    return result;
  }
}