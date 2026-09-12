package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Join row granting a permission to a role at a scope ({@code GLOBAL |
 * PROPERTY | OWN}). Bound to the Prisma {@code RolePermission} table.
 * Read-only for slice 1.
 */
@Entity
@Table(name = "RolePermission")
@IdClass(RolePermissionId.class)
public class RolePermission {

  @Id
  @Column(name = "roleId")
  private String roleId;

  @Id
  @Column(name = "permissionId")
  private String permissionId;

  @Id
  @Column(name = "scope")
  private String scope;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "permissionId", insertable = false, updatable = false)
  private Permission permission;

  protected RolePermission() {}

  public String getRoleId() { return roleId; }
  public String getPermissionId() { return permissionId; }
  public String getScope() { return scope; }
  public Permission getPermission() { return permission; }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof RolePermission that)) return false;
    return roleId.equals(that.roleId)
        && permissionId.equals(that.permissionId)
        && scope.equals(that.scope);
  }

  @Override
  public int hashCode() {
    int result = roleId.hashCode();
    result = 31 * result + permissionId.hashCode();
    result = 31 * result + scope.hashCode();
    return result;
  }
}