package com.rentmanager.kernel.domain;

import java.io.Serializable;
import java.util.Objects;

/** Composite id of {@link RolePermission}: {@code (roleId, permissionId, scope)}. */
public class RolePermissionId implements Serializable {

  private String roleId;
  private String permissionId;
  private String scope;

  protected RolePermissionId() {}

  public RolePermissionId(String roleId, String permissionId, String scope) {
    this.roleId = roleId;
    this.permissionId = permissionId;
    this.scope = scope;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof RolePermissionId that)) return false;
    return Objects.equals(roleId, that.roleId)
        && Objects.equals(permissionId, that.permissionId)
        && Objects.equals(scope, that.scope);
  }

  @Override
  public int hashCode() {
    return Objects.hash(roleId, permissionId, scope);
  }
}