package com.rentmanager.kernel.domain;

import java.io.Serializable;
import java.util.Objects;

/** Composite id of {@link UserRole}: {@code (userId, roleId)}. */
public class UserRoleId implements Serializable {

  private String userId;
  private String roleId;

  protected UserRoleId() {}

  public UserRoleId(String userId, String roleId) {
    this.userId = userId;
    this.roleId = roleId;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserRoleId that)) return false;
    return Objects.equals(userId, that.userId) && Objects.equals(roleId, that.roleId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, roleId);
  }
}